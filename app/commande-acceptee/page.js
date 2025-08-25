"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePersistentState } from "../lib/persist";
import { useToast } from "../components/ToastProvider";

// Simple utilities
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

export default function CommandeAccepteePage() {
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
        router.replace(`/commande-acceptee?id=${encodeURIComponent(saved)}`);
      }
    } catch {}
  }, [orderId, router]);

  const [order, setOrder] = useState(null); // {start, destination, driver, client, status}
  const [driverInfo, setDriverInfo] = useState(null); // {name, phone, plate, rating, id}
  const [driverPos, setDriverPos] = useState(null); // {lat, lon}
  const [clientPos, setClientPos] = useState(null); // {lat, lon}
  const [phase, setPhase] = useState('to_pickup'); // to_pickup | to_dest
  const pollRef = useRef(null);
  const [error, setError] = useState('');
  const [startNotified, setStartNotified] = useState(false);
  const [share, setShare] = useState({ open: false, url: "" });

  // Ensure we have an orderId: fallback from localStorage and update URL if needed
  useEffect(() => {
    if (orderId) return; // already present
    try {
      const saved = localStorage.getItem('tri_last_order_id');
      if (saved) {
        router.replace(`/commande-acceptee?id=${encodeURIComponent(saved)}`);
      }
    } catch {}
  }, [orderId, router]);

  // Load order details once and then poll to reflect assignment/status changes
  useEffect(() => {
    let intervalId = null;
    let stopped = false;
    const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
    const fetchOrder = async () => {
      try {
        if (!orderId) return;
        const token = localStorage.getItem('tri_token_client');
        if (!token) {
          router.push('/login');
          return;
        }
        const res = await fetch(`${base}/api/orders/${orderId}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          try {
            localStorage.removeItem('tri_token_client');
            localStorage.removeItem('tri_user_client');
          } catch {}
          router.replace('/login');
          return;
        }
        if (!res.ok) throw new Error(data?.error || 'Chargement impossible');
        if (stopped) return;
        setOrder(data);
        if (data?.driver) setDriverInfo({ ...data.driver });
        // On completion: redirect to fin-trajet
        if (data?.status === 'completed') {
          if (intervalId) clearInterval(intervalId);
          intervalId = null;
          try { console.debug('[commande-acceptee] order completed, redirecting to /fin-trajet', { orderId }); } catch {}
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
      intervalId = setInterval(fetchOrder, 4000);
    }
    return () => { stopped = true; if (intervalId) clearInterval(intervalId); };
  }, [orderId, router]);

  // Poll driver live location
  useEffect(() => {
    const start = () => {
      if (!driverInfo?.id) return;
      const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
      const token = localStorage.getItem('tri_token_client');
      const fetchLoc = async () => {
        try {
          const res = await fetch(`${base}/api/drivers/${driverInfo.id}/location`, { headers: { Authorization: `Bearer ${token}` } });
          const j = await res.json().catch(() => ({}));
          if (res.status === 401) {
            try {
              localStorage.removeItem('tri_token_client');
              localStorage.removeItem('tri_user_client');
            } catch {}
            router.replace('/login');
            return;
          }
          if (res.ok && j?.location) setDriverPos({ lat: j.location.lat, lon: j.location.lon });
        } catch {}
      };
      fetchLoc();
      pollRef.current = setInterval(fetchLoc, 4000);
    };
    start();
    return () => { if (pollRef.current) clearInterval(pollRef.current); pollRef.current = null; };
  }, [driverInfo?.id]);

  // Client location
  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setClientPos({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Phase from order status
  useEffect(() => {
    if (!order) return;
    if (order.status === 'assigned') setPhase('to_pickup');
    else if (order.status === 'in_progress') setPhase('to_dest');
  }, [order?.status]);

  // Notify client when the driver starts the ride, then redirect to trajet-en-cours
  useEffect(() => {
    if (!orderId || !order?.status) return;
    if (order.status === 'in_progress' && !startNotified) {
      setStartNotified(true);
      try { toast.info('Votre course va débuter. Redirection vers le suivi en temps réel...'); } catch {}
      router.replace(`/trajet-en-cours?id=${encodeURIComponent(orderId)}`);
    }
  }, [order?.status, orderId, startNotified, router]);

  // Handle driver cancellation: show popup and redirect to pre-commande
  useEffect(() => {
    if (!orderId || !order?.status) return;
    if (order.status === 'cancelled') {
      // stop polling driver location
      try { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } } catch {}
      // clear local last order id
      try { localStorage.removeItem('tri_last_order_id'); } catch {}
      try { toast.error('Le conducteur a annulé la commande.'); } catch {}
      router.replace('/pre-commande');
    }
  }, [order?.status, orderId, router]);

  const pickup = order?.start || null;
  const destination = order?.destination || null;

  const speedKmh = 22; // rough
  const target = phase === 'to_pickup' ? pickup : destination;
  // Remaining distance fallback logic:
  // - Prefer driver -> target
  // - If to_pickup and no driverPos, approximate with client -> pickup
  // - If to_dest and no driverPos, approximate with pickup -> destination (trip distance)
  const remainingKm = useMemo(() => {
    if (driverPos && target) return haversineKm(driverPos, target);
    if (phase === 'to_pickup' && clientPos && pickup) return haversineKm(clientPos, pickup);
    if (phase === 'to_dest' && pickup && destination) return haversineKm(pickup, destination);
    return 0;
  }, [driverPos, target, phase, clientPos, pickup, destination]);
  const etaMin = useMemo(() => {
    if (!remainingKm || remainingKm <= 0) return 0;
    return Math.max(1, Math.round((remainingKm / speedKmh) * 60));
  }, [remainingKm]);

  const [showCancel, setShowCancel] = usePersistentState("tri_ca_show_cancel", false);
  const cancelRide = () => setShowCancel(true);

  // Leaflet map refs
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({ base: null, driver: null, client: null, pickup: null, dest: null, routeDriverToClient: null, routeClientToDest: null });
  const LRef = useRef(null);
  const IconRef = useRef(null);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    let mounted = true;
    (async () => {
      const L = (await import("leaflet")).default;
      if (!mounted) return;
      LRef.current = L;

      // Default marker icon
      const DefaultIcon = L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], tooltipAnchor: [16, -28], shadowSize: [41, 41],
      });
      L.Marker.prototype.options.icon = DefaultIcon;
      IconRef.current = DefaultIcon;

      // Choose an initial center
      const cLat = (pickup?.lat ?? clientPos?.lat ?? 5.345);
      const cLon = (pickup?.lon ?? clientPos?.lon ?? -4.02);
      const map = L.map(mapContainerRef.current).setView([cLat, cLon], 14);
      const base = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
        updateWhenIdle: false,
        updateWhenZooming: true,
        keepBuffer: 2,
      }).addTo(map);
      base.on("load", () => { try { map.invalidateSize(false); } catch {} });

      mapRef.current = map;
      layersRef.current.base = base;
      setTimeout(() => { try { map.invalidateSize(false); } catch {} }, 0);
    })();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers and bounds when positions change
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;

    // clear existing markers/lines (keep persistent driver marker)
    for (const k of ["client", "pickup", "dest", "routeDriverToClient", "routeClientToDest"]) {
      if (layersRef.current[k]) { try { layersRef.current[k].remove(); } catch {} layersRef.current[k] = null; }
    }

    const pts = [];
    const addMarker = (pt, label) => {
      if (!pt?.lat || !pt?.lon) return null;
      pts.push(L.latLng(pt.lat, pt.lon));
      return L.marker([pt.lat, pt.lon]).addTo(map).bindTooltip(label);
    };

    if (pickup) layersRef.current.pickup = addMarker(pickup, "Départ");
    if (destination) layersRef.current.dest = addMarker(destination, "Arrivée");
    if (clientPos) layersRef.current.client = addMarker(clientPos, "Vous");

    // Driver marker: persist and update position smoothly
    if (driverPos && Number.isFinite(Number(driverPos.lat)) && Number.isFinite(Number(driverPos.lon))) {
      const newLatLng = L.latLng(Number(driverPos.lat), Number(driverPos.lon));
      if (layersRef.current.driver) {
        try {
          layersRef.current.driver.setLatLng(newLatLng);
          layersRef.current.driver.bindTooltip("Conducteur");
          layersRef.current.driver.bringToFront();
        } catch {}
      } else {
        layersRef.current.driver = L.marker(newLatLng).addTo(map).bindTooltip("Conducteur");
        try { layersRef.current.driver.bringToFront(); } catch {}
      }
      pts.push(newLatLng);
    }

    // draw lines
    // client path to destination (pickup -> dest)
    if (pickup && destination) {
      layersRef.current.routeClientToDest = L.polyline(
        [[pickup.lat, pickup.lon], [destination.lat, destination.lon]],
        { color: "#3b82f6", weight: 3, dashArray: "6 6" }
      ).addTo(map);
    }
    // driver to client (driver -> pickup)
    if (driverPos && pickup) {
      const dLat = Number(driverPos.lat);
      const dLon = Number(driverPos.lon);
      const pLat = Number(pickup.lat);
      const pLon = Number(pickup.lon);
      if (Number.isFinite(dLat) && Number.isFinite(dLon) && Number.isFinite(pLat) && Number.isFinite(pLon)) {
        layersRef.current.routeDriverToClient = L.polyline(
          [[dLat, dLon], [pLat, pLon]],
          { color: "#fb923c", weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }
        ).addTo(map);
        try { layersRef.current.routeDriverToClient.bringToFront(); } catch {}
      }
    } else if (!driverPos && pickup && clientPos && phase === 'to_pickup') {
      // Fallback path: client -> pickup while waiting for live driver position
      const cLat = Number(clientPos.lat);
      const cLon = Number(clientPos.lon);
      const pLat = Number(pickup.lat);
      const pLon = Number(pickup.lon);
      if (Number.isFinite(cLat) && Number.isFinite(cLon) && Number.isFinite(pLat) && Number.isFinite(pLon)) {
        layersRef.current.routeDriverToClient = L.polyline(
          [[cLat, cLon], [pLat, pLon]],
          { color: "#fb923c", weight: 4, opacity: 0.7, dashArray: "8 6" }
        ).addTo(map);
        try { layersRef.current.routeDriverToClient.bringToFront(); } catch {}
      }
    }

    // fit bounds if we have at least two points
    if (pts.length >= 2) {
      try { map.fitBounds(L.latLngBounds(pts), { padding: [30, 30] }); } catch {}
    } else if (pts.length === 1) {
      try { map.setView(pts[0], 15); } catch {}
    }

    setTimeout(() => { try { map.invalidateSize(false); } catch {} }, 0);
  }, [pickup, destination, clientPos, driverPos, phase]);

  const confirmCancel = async () => {
    try {
      setShowCancel(false);
      const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
      const token = localStorage.getItem('tri_token_client');
      if (!token) {
        router.replace('/login');
        return;
      }
      if (orderId) {
        try {
          const res = await fetch(`${base}/api/orders/${orderId}/cancel`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ reason: 'Client cancellation from UI' }),
          });
          if (res.status === 401) {
            try {
              localStorage.removeItem('tri_token_client');
              localStorage.removeItem('tri_user_client');
            } catch {}
            router.replace('/login');
            return;
          }
          // ignore errors: we still clear local and navigate
        } catch {}
      }
    } finally {
      // Stop driver polling
      try { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } } catch {}
      // Clear last order id so UI no longer reloads it
      try { localStorage.removeItem('tri_last_order_id'); } catch {}
      // Clear any page-local state
      setOrder(null);
      setDriverInfo(null);
      setDriverPos(null);
      setClientPos(null);
      // Notify and redirect to pre-commande
      try { toast.warning("Course annulée. Des frais d'annulation peuvent s'appliquer."); } catch {}
      router.replace('/pre-commande');
    }
  };

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
      const text = `Je partage mon trajet avec ${driverInfo?.name || 'le conducteur'}`;
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

  const callDriver = () => (driverInfo?.phone ? (window.location.href = `tel:${driverInfo.phone}`) : null);
  const smsDriver = () => (driverInfo?.phone ? (window.location.href = `sms:${driverInfo.phone}`) : null);
  const sos = () => toast.error("SOS déclenché. Nos équipes de sécurité sont alertées.");

  // Estimated price (demo) from pickup->destination remaining
  const tripKm = useMemo(() => (pickup && destination ? haversineKm(pickup, destination) : 0), [pickup?.lat, pickup?.lon, destination?.lat, destination?.lon]);
  const tripPrice = useMemo(() => order?.priceEstimate ?? (tripKm ? Math.max(700, Math.round(300 + tripKm * 180)) : '—'), [order?.priceEstimate, tripKm]);

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-amber-100">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Retour"
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M15.75 19.5a.75.75 0 0 1-.53-.22l-6-6a.75.75 0 0 1 0-1.06l6-6a.75.75 0 1 1 1.06 1.06L10.31 12l5.97 5.72a.75.75 0 0 1-.53 1.28Z"/></svg>
            </button>
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6 text-orange-600" viewBox="0 0 24 24" fill="currentColor"><path d="M5 12a7 7 0 0 1 14 0v6a2 2 0 0 1-2 2h-3a1 1 0 0 1-1-1v-3H11v3a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2v-6Z"/></svg>
              <span className="font-bold text-slate-800">Commande acceptée</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Map */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
          <div className="text-xs text-slate-500 mb-2">Position en temps réel</div>
          <div className="w-full h-64 rounded-xl overflow-hidden">
            <div ref={mapContainerRef} className="w-full h-64" />
          </div>
          <div className="mt-2 flex items-center justify-between text-sm text-slate-700">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-500" fill="currentColor"><path d="M12 8a1 1 0 0 1 1 1v3.38l2.24 1.29a1 1 0 1 1-1 1.74l-2.74-1.58A1 1 0 0 1 11 13V9a1 1 0 0 1 1-1Zm0-6a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z"/></svg>
              <span>{etaMin ? `${etaMin} min` : "—"}</span>
              <span>•</span>
              <span>{phase === "to_pickup" ? "Arrivée conducteur" : "Arrivée destination"}</span>
            </div>
            <div className="font-semibold text-slate-900">{tripPrice !== '—' ? `~${tripPrice} CFA` : '—'}</div>
          </div>
        </div>

        {/* Driver card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
          <div className="flex items-center gap-3">
            <img src={`https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(driverInfo?.name || 'driver')}`} alt={driverInfo?.name || ''} className="w-14 h-14 rounded-xl object-cover bg-slate-100" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-800 truncate">{driverInfo?.name || '—'}</div>
              <div className="text-xs text-slate-500 truncate">
                <span>{driverInfo?.phone || '—'}</span>
                <span className="mx-1">•</span>
                <span>{driverInfo?.plate ? `Plaque ${driverInfo.plate}` : 'Conducteur'}</span>
                <span className="mx-1">•</span>
                <span className="text-amber-600">★ {typeof driverInfo?.rating === 'number' ? driverInfo.rating.toFixed(1) : '—'}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <a
                href={driverInfo?.phone ? `tel:${String(driverInfo.phone).trim()}` : undefined}
                className={`text-center bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg px-3 py-1 text-sm ${driverInfo?.phone ? '' : 'pointer-events-none opacity-50'}`}
                aria-disabled={!driverInfo?.phone}
              >Appeler</a>
              <button type="button" onClick={smsDriver} className="bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg px-3 py-1 text-sm">Message</button>
            </div>
          </div>
        </div>

        {/* Order details (passengers, baggage, totals) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
          <div className="text-sm font-semibold text-slate-800">Détails de la commande</div>
          <div className="mt-1 text-sm text-slate-700">
            <div><span className="font-medium">Passagers:</span> {order?.passengers ?? '—'}</div>
            <div><span className="font-medium">Bagages:</span> {order?.bags ?? 0}</div>
            <div className="text-xs text-slate-500">Offre bagages: {typeof order?.bagOffer === 'number' ? `${order.bagOffer} CFA` : '—'}</div>
            {order?.bagDescription ? (
              <div className="text-xs text-slate-500">Description: {order.bagDescription}</div>
            ) : null}
            <div className="mt-1 text-sm font-semibold text-slate-900">Total estimé: {typeof order?.priceEstimate === 'number' ? `${order.priceEstimate} CFA` : '—'}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-3 gap-3">
          <button type="button" onClick={shareRide} className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-3 text-sm">Partager</button>
          <button type="button" onClick={sos} className="bg-red-50 hover:bg-red-100 text-red-700 rounded-xl py-3 text-sm">SOS</button>
          <button type="button" onClick={() => setShowCancel(true)} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl py-3 text-sm">Annuler</button>
        </div>

        {/* Cancel policy modal */}
      {showCancel && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-[90%] max-w-sm p-4">
            <div className="text-base font-semibold text-slate-800">Annuler la commande ?</div>
            <p className="text-sm text-slate-600 mt-1">
              L'annulation peut entraîner des frais si le conducteur est proche de votre point de départ.
            </p>
            <ul className="text-xs text-slate-500 mt-2 list-disc pl-5 space-y-1">
              <li>Frais possible: 300 CFA</li>
              <li>Vous pouvez reprogrammer depuis l'écran de commande</li>
            </ul>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setShowCancel(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-2 text-sm">Continuer</button>
              <button type="button" onClick={confirmCancel} className="bg-red-600 hover:bg-red-700 text-white rounded-xl py-2 text-sm">Confirmer l'annulation</button>
            </div>
          </div>
        </div>
      )}

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
