"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchRoute } from "../lib/routing";
import { useToast } from "../components/ToastProvider";
import RideBottomSheet from "../components/RideBottomSheet";

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
  const [routeInfo, setRouteInfo] = useState(null); // real road route pickup->dest {distanceKm, durationMin}
  // Bumps when the Leaflet map finishes initializing so dependent effects re-run
  const [mapReady, setMapReady] = useState(false);
  const [sheetH, setSheetH] = useState(0);

  const pickup = order?.start || null;
  const destination = order?.destination || null;

  const speedKmh = 22;
  // Prefer real road distance (OSRM) over straight-line estimate
  const totalKm = useMemo(() => {
    if (routeInfo?.distanceKm) return routeInfo.distanceKm;
    return (pickup && destination ? haversineKm(pickup, destination) : 0);
  }, [routeInfo, pickup?.lat, pickup?.lon, destination?.lat, destination?.lon]);
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
      if (!res.ok || !data?.token) { toast.error(data?.error || 'Création du lien impossible'); return; }
      // Build share URL dynamically from current origin
      let origin = '';
      try { origin = window.location.origin; } catch {}
      if (!origin) {
        origin = (process.env.NEXT_PUBLIC_FRONTEND_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');
      }
      const url = `${origin}/suivi/${data.token}`;
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
  const layersRef = useRef({ base: null, driver: null, pickup: null, dest: null, routeFull: null, routeLabels: null, trace: null });
  const LRef = useRef(null);
  const driverPathRef = useRef([]); // accumulated driver latlngs
  const fitDoneRef = useRef(false); // fit bounds once, then follow driver only if needed

  const onSheetHeight = useCallback((h) => setSheetH(h), []);

  // Fit bounds leaving room for the bottom sheet (same as /commander)
  const fitTripBounds = useCallback((bounds) => {
    const map = mapRef.current;
    if (!map || !bounds) return;
    const bottomPad = Math.max(120, Math.round((sheetH || 0) * 0.9));
    try { map.fitBounds(bounds, { paddingTopLeft: [24, 90], paddingBottomRight: [24, bottomPad] }); } catch {}
  }, [sheetH]);

  // init map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    let mounted = true;
    (async () => {
      const L = (await import('leaflet')).default;
      if (!mounted) return;
      LRef.current = L;
      const cLat = (pickup?.lat ?? 5.345);
      const cLon = (pickup?.lon ?? -4.02);
      const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([cLat, cLon], 14);
      const base = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
        updateWhenIdle: false,
        updateWhenZooming: true,
        keepBuffer: 2,
      }).addTo(map);
      mapRef.current = map;
      layersRef.current.base = base;
      setMapReady(true);
      setTimeout(() => { try { map.invalidateSize(false); } catch {} }, 0);
    })();
    return () => { mounted = false; };
  }, []);

  // update markers and lines
  useEffect(() => {
    const map = mapRef.current; const L = LRef.current;
    if (!map || !L) return;
    for (const k of ['pickup', 'dest', 'routeFull']) { // keep persistent driver and trace
      if (layersRef.current[k]) { try { layersRef.current[k].remove(); } catch {} layersRef.current[k] = null; }
    }
    if (layersRef.current.routeLabels) {
      layersRef.current.routeLabels.forEach((l) => { try { l.remove(); } catch {} });
      layersRef.current.routeLabels = null;
    }

    // Compact endpoint pins: white circle, thick dark border, modal icon inside (same as /commander)
    const pinIcon = (src, alt) =>
      L.divIcon({
        className: "",
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -14],
        tooltipAnchor: [0, -14],
        html: `<div style="width:30px;height:30px;border-radius:9999px;background:#fff;border:4px solid #1f2937;box-shadow:0 1px 5px rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center"><img src="${src}" alt="${alt}" style="width:15px;height:15px;display:block" /></div>`,
      });

    // Vehicle marker: orange circle, thick white border, car glyph inside
    const driverIcon = L.divIcon({
      className: "tricycle-driver-marker",
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      tooltipAnchor: [0, -20],
      html: `<div style="width:40px;height:40px;border-radius:9999px;background:#ea580c;border:4px solid #fff;box-shadow:0 2px 8px rgba(15,23,42,.4);display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M5 12a7 7 0 0 1 14 0v6a2 2 0 0 1-2 2h-3a1 1 0 0 1-1-1v-3H11v3a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2v-6Z"/></svg></div>`,
    });

    const pts = [];
    if (pickup?.lat != null && pickup?.lon != null) {
      layersRef.current.pickup = L.marker([pickup.lat, pickup.lon], { icon: pinIcon("/depart.png", "Départ") }).addTo(map).bindTooltip("Départ");
      pts.push(L.latLng(pickup.lat, pickup.lon));
    }
    if (destination?.lat != null && destination?.lon != null) {
      layersRef.current.dest = L.marker([destination.lat, destination.lon], { icon: pinIcon("/destination.png", "Arrivée") }).addTo(map).bindTooltip("Arrivée");
      pts.push(L.latLng(destination.lat, destination.lon));
    }

    // Driver marker: persist and update smoothly (CSS transition animates the move)
    if (driverPos && Number.isFinite(Number(driverPos.lat)) && Number.isFinite(Number(driverPos.lon))) {
      const dLatLng = L.latLng(Number(driverPos.lat), Number(driverPos.lon));
      if (layersRef.current.driver) {
        try { layersRef.current.driver.setLatLng(dLatLng); layersRef.current.driver.bringToFront(); } catch {}
      } else {
        layersRef.current.driver = L.marker(dLatLng, { icon: driverIcon }).addTo(map).bindTooltip('Conducteur');
        try { layersRef.current.driver.bringToFront(); } catch {}
      }
      // accumulate trace
      driverPathRef.current.push(dLatLng);
      if (driverPathRef.current.length > 1) {
        if (layersRef.current.trace) { try { layersRef.current.trace.setLatLngs(driverPathRef.current); layersRef.current.trace.bringToFront(); } catch {} }
        else { layersRef.current.trace = L.polyline(driverPathRef.current, { color: '#0f172a', weight: 3, opacity: 0.6 }).addTo(map); }
      }
      pts.push(dLatLng);
    }

    // full route pickup->dest (fixed itinerary selected by client) — real road route via OSRM
    if (pickup && destination) {
      const line = L.polyline([[pickup.lat, pickup.lon], [destination.lat, destination.lon]], { color: '#94a3b8', weight: 3, dashArray: '6 6' }).addTo(map);
      layersRef.current.routeFull = line;
      fetchRoute(pickup, destination).then((r) => {
        if (!r || layersRef.current.routeFull !== line) return;
        setRouteInfo({ distanceKm: r.distanceKm, durationMin: r.durationMin });
        try {
          line.setLatLngs(r.coordinates);
          if (!r.fallback) line.setStyle({ color: '#fb923c', weight: 5, opacity: 0.9, dashArray: null });

          // Route labels: distance on the line + ETA badge (same as /commander)
          const coords = r.coordinates;
          if (coords.length >= 2) {
            const kmLabel = Number.isFinite(r.distanceKm) ? `${r.distanceKm.toFixed(1)} km` : null;
            const etaLabel = Number.isFinite(r.durationMin) ? `${Math.round(r.durationMin)} min` : null;
            const labels = [];
            if (kmLabel) {
              const at = coords[Math.floor(coords.length * 0.45)];
              labels.push(
                L.marker(at, {
                  interactive: false,
                  keyboard: false,
                  icon: L.divIcon({
                    className: "",
                    iconSize: [56, 20],
                    iconAnchor: [28, 10],
                    html: `<div style="background:rgba(255,255,255,.95);color:#334155;font-weight:700;font-size:11px;line-height:20px;text-align:center;border-radius:6px;box-shadow:0 1px 4px rgba(15,23,42,.25);white-space:nowrap">${kmLabel}</div>`,
                  }),
                }).addTo(map)
              );
            }
            if (etaLabel) {
              const at = coords[Math.floor(coords.length * 0.65)];
              labels.push(
                L.marker(at, {
                  interactive: false,
                  keyboard: false,
                  icon: L.divIcon({
                    className: "",
                    iconSize: [56, 28],
                    iconAnchor: [28, 14],
                    html: `<div style="background:#ea580c;color:#fff;font-weight:800;font-size:12px;line-height:22px;text-align:center;border-radius:8px;border:3px solid #fff;box-shadow:0 2px 8px rgba(15,23,42,.3);white-space:nowrap">${etaLabel}</div>`,
                  }),
                }).addTo(map)
              );
            }
            layersRef.current.routeLabels = labels;
          }
        } catch {}
      });
    }

    // Fit once when we first have meaningful geometry, then only re-center on
    // the driver when it leaves the visible area (lets the user pan/zoom freely).
    if (!fitDoneRef.current && pts.length >= 2) {
      fitDoneRef.current = true;
      fitTripBounds(L.latLngBounds(pts));
    } else if (!fitDoneRef.current && pts.length === 1) {
      try { map.setView(pts[0], 15); } catch {}
    } else if (driverPos && Number.isFinite(Number(driverPos.lat)) && Number.isFinite(Number(driverPos.lon))) {
      const dLatLng = L.latLng(Number(driverPos.lat), Number(driverPos.lon));
      try { if (!map.getBounds().pad(-0.15).contains(dLatLng)) map.panTo(dLatLng, { animate: true }); } catch {}
    }
    setTimeout(() => { try { map.invalidateSize(false); } catch {} }, 0);
  }, [pickup, destination, driverPos, mapReady, fitTripBounds]);

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-white">
      {/* Carte plein écran (isolate: les z-index internes de Leaflet restent sous la sheet) */}
      <div ref={mapContainerRef} className="absolute inset-0 isolate" />

      {/* Barre flottante : retour + indicateur temps réel */}
      <div className="absolute top-0 inset-x-0 z-[500] pointer-events-none">
        <div className="max-w-md mx-auto px-3 pt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Retour"
            className="pointer-events-auto w-10 h-10 shrink-0 bg-white rounded-full shadow-md flex items-center justify-center text-slate-600"
          >
            <img src="/retour.svg" alt="Retour" className="w-5 h-5" />
          </button>
          <div className="pointer-events-auto bg-white rounded-full shadow-md px-4 py-2.5 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${driverPos ? 'bg-emerald-400' : 'bg-orange-400'}`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${driverPos ? 'bg-emerald-500' : 'bg-orange-500'}`} />
            </span>
            <span className="text-sm font-medium text-slate-700">Suivi en temps réel</span>
          </div>
        </div>
      </div>

      {/* Bottom sheet */}
      <RideBottomSheet
        onHeightChange={onSheetHeight}
        footer={(
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={shareRide} className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-3 text-sm font-medium">Partager</button>
            <button type="button" onClick={sos} className="bg-red-50 hover:bg-red-100 text-red-700 rounded-xl py-3 text-sm font-semibold">SOS</button>
          </div>
        )}
      >
        {/* État + distance/temps restant */}
        <div className="pt-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${driverPos ? 'bg-emerald-400' : 'bg-orange-400'}`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${driverPos ? 'bg-emerald-500' : 'bg-orange-500'}`} />
            </span>
            <span className="text-sm font-semibold text-slate-800">Trajet en cours</span>
          </div>
          <div className="flex items-end justify-between gap-3 mt-2">
            <div className="text-3xl font-black text-slate-900">
              {remainingKm ? `${remainingKm.toFixed(1)} km` : '—'}
            </div>
            <div className="text-sm font-medium text-slate-600 pb-1 whitespace-nowrap">
              {etaMin ? `${etaMin} min` : '—'} restantes
            </div>
          </div>
          <div className="text-xs text-slate-500 truncate mt-1">
            {pickup?.name || 'Départ'} → {destination?.name || 'Destination'}
          </div>
        </div>

        {/* Progression du trajet */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Progression</span>
            <span className="font-semibold text-slate-800">{progressPct}%</span>
          </div>
          <div className="mt-2 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div className="bg-orange-500 h-2 rounded-full transition-all duration-700" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="mt-2 text-xs text-slate-500">
            La carte suit le déplacement du conducteur en temps réel.
          </div>
        </div>

        {/* Conducteur */}
        {driverInfo && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
            <div className="flex items-center gap-3">
              <img src={`https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(driverInfo?.name || 'driver')}`} alt={driverInfo?.name || ''} className="w-12 h-12 rounded-xl object-cover bg-slate-100" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-800 truncate">{driverInfo?.name || '—'}</div>
                <div className="text-xs text-slate-500 truncate">
                  <span>{driverInfo?.phone || '—'}</span>
                  {driverInfo?.plate ? (<><span className="mx-1">•</span><span>Plaque {driverInfo.plate}</span></>) : null}
                </div>
              </div>
            </div>
          </div>
        )}

        {error ? <div className="text-sm text-red-600">{error}</div> : null}

        <button
          type="button"
          onClick={() => router.push(`/details-trajet${orderId ? `?id=${encodeURIComponent(orderId)}` : ''}`)}
          className="text-xs font-medium text-orange-700 hover:underline"
        >Voir les détails du trajet</button>
      </RideBottomSheet>

      {/* Share fallback modal */}
      {share.open && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40" style={{ zIndex: 9999 }}>
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
  );
}

export default function TrajetEnCoursPage() {
  return (
    <Suspense fallback={null}>
      <TrajetEnCoursContent />
    </Suspense>
  );
}
