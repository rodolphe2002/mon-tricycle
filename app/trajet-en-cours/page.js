"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "../components/ToastProvider";

const toRad = (x) => (x * Math.PI) / 180;
const haversineKm = (a, b) => {
  if (!a || !b) return 0;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

const VIEWPORT = { minLat: 5.28, maxLat: 5.38, minLon: -4.10, maxLon: -3.95 };
const projectToViewBox = ({ lat, lon }, width, height) => {
  const pad = 12;
  const x = ((lon - VIEWPORT.minLon) / (VIEWPORT.maxLon - VIEWPORT.minLon)) * (width - 2 * pad) + pad;
  const y = (1 - (lat - VIEWPORT.minLat) / (VIEWPORT.maxLat - VIEWPORT.minLat)) * (height - 2 * pad) + pad;
  return { x, y };
};

function TrajetEnCoursContent() {
  const router = useRouter();
  const params = useSearchParams();
  const orderId = params.get('id');
  const toast = useToast();

  // Ensure we have an orderId: fallback from localStorage and update URL if needed
  useEffect(() => {
    if (orderId) return;
    try {
      const saved = localStorage.getItem('tri_last_order_id');
      if (saved) {
        router.replace(`/trajet-en-cours?id=${encodeURIComponent(saved)}`);
      }
    } catch {}
  }, [orderId, router]);

  const [order, setOrder] = useState(null); // {start, destination, driver, status}
  const [driverInfo, setDriverInfo] = useState(null); // {id, name, phone}
  const [driverPos, setDriverPos] = useState(null); // {lat, lon}
  const [error, setError] = useState('');
  const locPollRef = useRef(null);
  const [share, setShare] = useState({ open: false, url: "" });

  const pickup = order?.start || null;
  const destination = order?.destination || null;

  const speedKmh = 22;
  const totalKm = useMemo(() => (pickup && destination ? haversineKm(pickup, destination) : 0), [pickup?.lat, pickup?.lon, destination?.lat, destination?.lon]);
  // Fallback: if driverPos unknown, remaining = total (progress = 0%)
  const remainingKm = useMemo(() => {
    if (driverPos && destination) return haversineKm(driverPos, destination);
    if (totalKm) return totalKm;
    return 0;
  }, [driverPos, destination, totalKm]);
  const etaMin = useMemo(() => (remainingKm ? Math.max(1, Math.round((remainingKm / speedKmh) * 60)) : 0), [remainingKm]);
  const progressPct = useMemo(() => {
    const done = Math.max(0, totalKm - remainingKm);
    return totalKm ? Math.max(0, Math.min(100, Math.round((done / totalKm) * 100))) : 0;
  }, [totalKm, remainingKm]);

  // Load order details and keep updated
  useEffect(() => {
    let intId = null;
    let stopped = false;
    const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
    const fetchOrder = async () => {
      try {
        if (!orderId) return;
        const token = localStorage.getItem('tri_token_client');
        if (!token) { router.replace('/login'); return; }
        const res = await fetch(`${base}/api/orders/${orderId}?t=${Date.now()}`,
          { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
        );
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) { try { localStorage.removeItem('tri_token_client'); localStorage.removeItem('tri_user_client'); } catch {} router.replace('/login'); return; }
        if (!res.ok) throw new Error(data?.error || 'Erreur chargement commande');
        if (stopped) return;
        setOrder(data);
        if (data?.driver) setDriverInfo({ ...data.driver });
        if (data?.status === 'completed') {
          try { console.debug('[trajet-en-cours] order completed, redirecting to /fin-trajet', { orderId }); } catch {}
          if (intId) clearInterval(intId); intId = null;
          const q = orderId ? `?id=${encodeURIComponent(orderId)}` : '';
          router.replace(`/fin-trajet${q}`);
          return;
        }
      } catch (e) {
        if (!stopped) setError(e?.message || 'Erreur');
      }
    };
    if (orderId) {
      fetchOrder();
      intId = setInterval(fetchOrder, 6000);
    }
    return () => { stopped = true; if (intId) clearInterval(intId); };
  }, [orderId, router]);

  // Poll driver live location
  useEffect(() => {
    const start = () => {
      if (!driverInfo?.id) return;
      const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
      const token = localStorage.getItem('tri_token_client');
      const fetchLoc = async () => {
        try {
          const res = await fetch(`${base}/api/drivers/${driverInfo.id}/location?t=${Date.now()}`,
            { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
          );
          const j = await res.json().catch(() => ({}));
          if (res.status === 401) { try { localStorage.removeItem('tri_token_client'); localStorage.removeItem('tri_user_client'); } catch {} router.replace('/login'); return; }
          if (res.ok && j?.location) setDriverPos({ lat: j.location.lat, lon: j.location.lon });
        } catch {}
      };
      fetchLoc();
      locPollRef.current = setInterval(fetchLoc, 3000);
    };
    start();
    return () => { if (locPollRef.current) clearInterval(locPollRef.current); locPollRef.current = null; };
  }, [driverInfo?.id, router]);

  // Preferences removed

  const shareRide = async () => {
    try {
      if (!orderId) { toast.error('Commande inconnue'); return; }
      const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
      const token = localStorage.getItem('tri_token_client');
      if (!token) { router.replace('/login'); return; }
      const res = await fetch(`${base}/api/orders/${orderId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) { try { localStorage.removeItem('tri_token_client'); localStorage.removeItem('tri_user_client'); } catch {} router.replace('/login'); return; }
      if (!res.ok || !data?.url) { toast.error(data?.error || 'Création du lien impossible'); return; }
      const url = data.url;
      const title = 'Suivez mon trajet Tricycle';
      const text = `Mon ETA: ~${etaMin} min`;
      try {
        if (navigator.share) {
          await navigator.share({ title, text, url });
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(url);
          toast.success('Lien de suivi copié dans le presse-papiers.');
        } else {
          setShare({ open: true, url });
        }
      } catch {}
    } catch (e) {
      toast.error('Partage indisponible');
    }
  };

  const sos = () => toast.error("SOS déclenché. Nos équipes de sécurité sont alertées.");

  // Leaflet map
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({ base: null, driver: null, pickup: null, dest: null, routeDriverToDest: null, routeFull: null, trace: null });
  const LRef = useRef(null);
  const driverPathRef = useRef([]); // accumulated driver latlngs

  // init map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    let mounted = true;
    (async () => {
      const L = (await import('leaflet')).default;
      if (!mounted) return;
      LRef.current = L;
      // Fix marker icon 404: use CDN images for default marker
      const DefaultIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], tooltipAnchor: [16, -28], shadowSize: [41, 41],
      });
      L.Marker.prototype.options.icon = DefaultIcon;
      const cLat = (pickup?.lat ?? 5.345);
      const cLon = (pickup?.lon ?? -4.02);
      const map = L.map(mapContainerRef.current).setView([cLat, cLon], 14);
      const base = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);
      mapRef.current = map;
      layersRef.current.base = base;
      setTimeout(() => { try { map.invalidateSize(false); } catch {} }, 0);
    })();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // update markers and lines
  useEffect(() => {
    const map = mapRef.current; const L = LRef.current;
    if (!map || !L) return;
    for (const k of ['pickup','dest','routeDriverToDest','routeFull']) { // keep persistent driver and trace
      if (layersRef.current[k]) { try { layersRef.current[k].remove(); } catch {} layersRef.current[k] = null; }
    }
    const pts = [];
    const addMarker = (pt, label) => { if (!pt?.lat || !pt?.lon) return null; pts.push(L.latLng(pt.lat, pt.lon)); return L.marker([pt.lat, pt.lon]).addTo(map).bindTooltip(label); };
    if (pickup) layersRef.current.pickup = addMarker(pickup, 'Départ');
    if (destination) layersRef.current.dest = addMarker(destination, 'Arrivée');
    // Driver marker: persist and update smoothly
    if (driverPos && Number.isFinite(Number(driverPos.lat)) && Number.isFinite(Number(driverPos.lon))) {
      const dLatLng = L.latLng(Number(driverPos.lat), Number(driverPos.lon));
      if (layersRef.current.driver) {
        try { layersRef.current.driver.setLatLng(dLatLng); layersRef.current.driver.bindTooltip('Conducteur'); layersRef.current.driver.bringToFront(); } catch {}
      } else {
        layersRef.current.driver = L.marker(dLatLng).addTo(map).bindTooltip('Conducteur');
        try { layersRef.current.driver.bringToFront(); } catch {}
      }
      // accumulate trace
      driverPathRef.current.push(dLatLng);
      if (driverPathRef.current.length > 1) {
        if (layersRef.current.trace) { try { layersRef.current.trace.setLatLngs(driverPathRef.current); layersRef.current.trace.bringToFront(); } catch {} }
        else { layersRef.current.trace = L.polyline(driverPathRef.current, { color:'#fb923c', weight:3, opacity:0.7 }).addTo(map); }
      }
      pts.push(dLatLng);
    }
    // full route pickup->dest (context)
    if (pickup && destination) {
      layersRef.current.routeFull = L.polyline([[pickup.lat,pickup.lon],[destination.lat,destination.lon]], { color:'#94a3b8', weight:3, dashArray:'6 6' }).addTo(map);
    }
    // current path driver->dest
    if (driverPos && destination) {
      layersRef.current.routeDriverToDest = L.polyline([[driverPos.lat,driverPos.lon],[destination.lat,destination.lon]], { color:'#fb923c', weight:5, opacity:0.9, lineCap:'round', lineJoin:'round' }).addTo(map);
      try { layersRef.current.routeDriverToDest.bringToFront(); } catch {}
    }
    if (pts.length >= 2) { try { map.fitBounds(L.latLngBounds(pts), { padding:[30,30] }); } catch {} } else if (pts.length === 1) { try { map.setView(pts[0], 15); } catch {} }
    setTimeout(() => { try { map.invalidateSize(false); } catch {} }, 0);
  }, [pickup, destination, driverPos]);

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-amber-100">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-orange-600" viewBox="0 0 24 24" fill="currentColor"><path d="M5 12a7 7 0 0 1 14 0v6a2 2 0 0 1-2 2h-3a1 1 0 0 1-1-1v-3H11v3a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2v-6Z"/></svg>
            <span className="font-bold text-slate-800">Trajet en cours</span>
          </div>
          <button type="button" onClick={() => router.push("/")} className="text-sm text-orange-700 hover:underline">Accueil</button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Map */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
          <div className="text-xs text-slate-500 mb-2">Progression du trajet</div>
          <div className="w-full h-64 rounded-xl overflow-hidden">
            <div ref={mapContainerRef} className="w-full h-64" />
          </div>
          <div className="mt-2 flex items-center justify-between text-sm text-slate-700">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-500" fill="currentColor"><path d="M12 8a1 1 0 0 1 1 1v3.38l2.24 1.29a1 1 0 1 1-1 1.74l-2.74-1.58A1 1 0 0 1 11 13V9a1 1 0 0 1 1-1Zm0-6a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z"/></svg>
              <span>{remainingKm ? `${remainingKm.toFixed(1)} km` : "—"}</span>
              <span>•</span>
              <span>{etaMin ? `${etaMin} min` : "—"}</span>
            </div>
            <div className="text-xs text-slate-500">{progressPct}%</div>
          </div>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div className="bg-orange-500 h-2" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-3 gap-3">
          <button type="button" onClick={shareRide} className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-3 text-sm">Partager</button>
          <button type="button" onClick={sos} className="bg-red-50 hover:bg-red-100 text-red-700 rounded-xl py-3 text-sm">SOS</button>
          <button type="button" onClick={() => router.push(`/details-trajet${orderId ? `?id=${encodeURIComponent(orderId)}` : ''}`)} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl py-3 text-sm">Détails</button>
        </div>

        {/* Share fallback modal */}
        {share.open && (
          <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl w-[90%] max-w-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-base font-semibold text-slate-800">Lien de suivi</div>
                <button type="button" onClick={() => setShare({ open: false, url: '' })} className="text-slate-500 hover:text-slate-700">Fermer</button>
              </div>
              <div className="text-xs text-slate-500 mb-2">Copiez ce lien pour le partager</div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 break-all text-xs text-slate-700">{share.url}</div>
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try { await navigator.clipboard?.writeText(share.url); toast.success('Lien copié'); } catch { toast.error('Copie impossible'); }
                  }}
                  className="bg-orange-600 hover:bg-orange-700 text-white rounded-lg px-3 py-2 text-sm"
                >Copier</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="h-8" />
    </div>
  );
}

export default function TrajetEnCoursPage() {
  return (
    <Suspense fallback={null}>
      <TrajetEnCoursContent />
    </Suspense>
  );
}
