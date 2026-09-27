"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePersistentState } from "../lib/persist";
import { fetchRoute } from "../lib/routing";
import { useToast } from "../components/ToastProvider";
import RideBottomSheet from "../components/RideBottomSheet";

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

function CommandeAccepteeContent() {
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
  // Show a one-time modal when the driver accepts the order
  const acceptedShownRef = useRef(false);
  const [acceptedModal, setAcceptedModal] = useState(false);

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
        // Notify on first transition to 'assigned' (driver accepted)
        if (data?.status === 'assigned' && !acceptedShownRef.current) {
          const key = orderId ? `tri_accept_notified_${orderId}` : null;
          let already = false;
          try { if (key && localStorage.getItem(key) === '1') already = true; } catch {}
          if (!already) {
            setAcceptedModal(true);
            try { if (key) localStorage.setItem(key, '1'); } catch {}
          }
          acceptedShownRef.current = true;
        }
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
  const isDriverAssigned = order?.status === 'assigned' || order?.status === 'in_progress';
  // {distanceKm, durationMin} driver->pickup via road (OSRM)
  const [routeEta, setRouteEta] = useState(null);

  const speedKmh = 22; // rough
  const target = phase === 'to_pickup' ? pickup : destination;
  // Remaining distance fallback logic:
  // - Prefer driver -> target
  // - If to_pickup and no driverPos, approximate with client -> pickup
  // - If to_dest and no driverPos, approximate with pickup -> destination (trip distance)
  const remainingKm = useMemo(() => {
    if (!isDriverAssigned) return 0; // do not compute before assignment
    if (driverPos && target) return haversineKm(driverPos, target);
    if (phase === 'to_pickup' && clientPos && pickup) return haversineKm(clientPos, pickup);
    if (phase === 'to_dest' && pickup && destination) return haversineKm(pickup, destination);
    return 0;
  }, [driverPos, target, phase, clientPos, pickup, destination, isDriverAssigned]);
  const etaMin = useMemo(() => {
    if (!isDriverAssigned) return 0;
    if (phase === 'to_pickup' && routeEta?.durationMin) return routeEta.durationMin;
    if (!remainingKm || remainingKm <= 0) return 0;
    return Math.max(1, Math.round((remainingKm / speedKmh) * 60));
  }, [remainingKm, isDriverAssigned, phase, routeEta]);

  const [showCancel, setShowCancel] = usePersistentState("tri_ca_show_cancel", false);

  // Leaflet map refs
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({ base: null, driver: null, client: null, pickup: null, dest: null, routeDriverToClient: null, routeClientToDest: null });
  const LRef = useRef(null);
  const IconRef = useRef(null);
  // Bumps when the Leaflet map finishes initializing so dependent effects re-run
  const [mapReady, setMapReady] = useState(false);
  // Last routed driver->pickup leg to avoid re-requesting OSRM on every position poll
  const driverRouteRef = useRef({ from: null, coords: null });

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
      const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([cLat, cLon], 14);
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
      setMapReady(true);
      setTimeout(() => { try { map.invalidateSize(false); } catch {} }, 0);
    })();
    return () => { mounted = false; };
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

    // Always show pickup marker (client selected start)
    if (pickup) layersRef.current.pickup = addMarker(pickup, "Départ");
    // Only show destination marker when the ride is in progress (after pickup)
    if (isDriverAssigned && phase === 'to_dest' && destination) {
      layersRef.current.dest = addMarker(destination, "Arrivée");
    }
    // Do not show client marker to avoid confusion; focus on driver vs pickup

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

    // draw lines (only after driver is assigned) — real road routes via OSRM
    if (isDriverAssigned) {
      // client path to destination (pickup -> dest)
      if (pickup && destination) {
        const line = L.polyline(
          [[pickup.lat, pickup.lon], [destination.lat, destination.lon]],
          { color: "#3b82f6", weight: 3, dashArray: "6 6" }
        ).addTo(map);
        layersRef.current.routeClientToDest = line;
        fetchRoute(pickup, destination).then((r) => {
          if (!r || layersRef.current.routeClientToDest !== line) return;
          try { line.setLatLngs(r.coordinates); } catch {}
        });
      }
      // driver to client (driver -> pickup)
      if (driverPos && pickup) {
        const dLat = Number(driverPos.lat);
        const dLon = Number(driverPos.lon);
        const pLat = Number(pickup.lat);
        const pLon = Number(pickup.lon);
        if (Number.isFinite(dLat) && Number.isFinite(dLon) && Number.isFinite(pLat) && Number.isFinite(pLon)) {
          const from = { lat: dLat, lon: dLon };
          const last = driverRouteRef.current;
          const movedM = last.from ? haversineKm(last.from, from) * 1000 : Infinity;
          const style = { color: "#fb923c", weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round' };
          if (movedM > 50 || !last.coords) {
            driverRouteRef.current.from = from;
            const line = L.polyline([[dLat, dLon], [pLat, pLon]], style).addTo(map);
            layersRef.current.routeDriverToClient = line;
            try { line.bringToFront(); } catch {}
            fetchRoute(from, { lat: pLat, lon: pLon }).then((r) => {
              if (!r || layersRef.current.routeDriverToClient !== line) return;
              driverRouteRef.current.coords = r.coordinates;
              setRouteEta({ distanceKm: r.distanceKm, durationMin: r.durationMin });
              try { line.setLatLngs(r.coordinates); } catch {}
            });
          } else {
            const line = L.polyline(last.coords, style).addTo(map);
            layersRef.current.routeDriverToClient = line;
            try { line.bringToFront(); } catch {}
          }
        }
      }
    } else {
      driverRouteRef.current = { from: null, coords: null };
      setRouteEta(null);
    }

    // fit bounds if we have at least two points (leave room for the bottom sheet)
    if (pts.length >= 2) {
      const bottomPad = typeof window !== "undefined" ? Math.round(window.innerHeight * 0.5) : 300;
      try { map.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [24, 80], paddingBottomRight: [24, bottomPad] }); } catch {}
    } else if (pts.length === 1) {
      try { map.setView(pts[0], 15); } catch {}
    }

    setTimeout(() => { try { map.invalidateSize(false); } catch {} }, 0);
  }, [pickup, destination, clientPos, driverPos, phase, isDriverAssigned, mapReady]);

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
      if (!res.ok || !data?.token) { toast.error(data?.error || 'Création du lien impossible'); return; }
      // Build share URL dynamically from current origin to avoid hardcoded localhost
      let origin = '';
      try { origin = window.location.origin; } catch {}
      if (!origin) {
        // Fallback to env or localhost
        origin = (process.env.NEXT_PUBLIC_FRONTEND_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');
      }
      const url = `${origin}/suivi/${data.token}`;
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

  const smsDriver = () => (driverInfo?.phone ? (window.location.href = `sms:${driverInfo.phone}`) : null);
  const sos = () => toast.error("SOS déclenché. Nos équipes de sécurité sont alertées.");

  // Estimated price (demo) from pickup->destination remaining
  const tripKm = useMemo(() => (pickup && destination ? haversineKm(pickup, destination) : 0), [pickup?.lat, pickup?.lon, destination?.lat, destination?.lon]);
  const tripPrice = useMemo(() => order?.priceEstimate ?? (tripKm ? Math.max(700, Math.round(300 + tripKm * 180)) : '—'), [order?.priceEstimate, tripKm]);

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
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isDriverAssigned ? 'bg-emerald-400' : 'bg-orange-400'}`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isDriverAssigned ? 'bg-emerald-500' : 'bg-orange-500'}`} />
            </span>
            <span className="text-sm font-medium text-slate-700">Position en temps réel</span>
          </div>
        </div>
      </div>

      {/* Bottom sheet */}
      <RideBottomSheet
        footer={(
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={sos} className="bg-red-50 hover:bg-red-100 text-red-700 rounded-xl py-3 text-sm font-semibold">SOS</button>
            <button type="button" onClick={() => setShowCancel(true)} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl py-3 text-sm font-medium">Annuler</button>
          </div>
        )}
      >
        {/* État de la commande + prix */}
        <div className="pt-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isDriverAssigned ? 'bg-emerald-400' : 'bg-orange-400'}`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isDriverAssigned ? 'bg-emerald-500' : 'bg-orange-500'}`} />
            </span>
            <span className="text-sm font-semibold text-slate-800">
              {isDriverAssigned
                ? (phase === "to_pickup" ? "Conducteur en route vers vous" : "En route vers la destination")
                : "À la recherche d’un conducteur"}
            </span>
            <button
              type="button"
              onClick={shareRide}
              aria-label="Partager la commande"
              title="Partager"
              className="ml-auto shrink-0 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
            >
              <img src="/partager.svg" alt="" className="w-4 h-4" />
            </button>
          </div>
          {!isDriverAssigned && (
            <div className="text-xs text-slate-500 mt-0.5 pl-5">Nous contactons les conducteurs à proximité…</div>
          )}
          <div className="flex items-end justify-between gap-3 mt-2">
            <div className="text-3xl font-black text-slate-900">
              {tripPrice !== '—' ? `~${tripPrice} CFA` : '—'}
            </div>
            {isDriverAssigned && (
              <div className="text-sm font-medium text-slate-600 pb-1 whitespace-nowrap">
                {etaMin ? `${etaMin} min` : "—"} • {phase === "to_pickup" ? "arrivée conducteur" : "arrivée destination"}
              </div>
            )}
          </div>
          <div className="text-xs text-slate-500 truncate mt-1">
            {pickup?.name || "Départ"} → {destination?.name || "Destination"}
          </div>
        </div>

        {/* Carte conducteur (une fois assigné) */}
        {isDriverAssigned && (
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
        )}

        {/* Détails de la commande */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="text-sm font-semibold text-slate-700">Détails de la commande</div>
          <div className="divide-y divide-slate-100 text-sm">
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-600">Départ:</span>
              <span className="font-medium text-slate-900 text-right truncate pl-3">{pickup?.name || "—"}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-600">Destination:</span>
              <span className="font-medium text-slate-900 text-right truncate pl-3">{destination?.name || "—"}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-600">Passagers:</span>
              <span className="font-medium text-slate-900">{order?.passengers ?? '—'}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-600">Bagages:</span>
              <span className="font-medium text-slate-900">{order?.bags ?? 0}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-600">Offre bagages:</span>
              <span className="font-medium text-slate-900">{typeof order?.bagOffer === 'number' ? `${order.bagOffer} CFA` : '—'}</span>
            </div>
            {order?.bagDescription ? (
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-600">Description:</span>
                <span className="font-medium text-slate-900 text-right truncate pl-3">{order.bagDescription}</span>
              </div>
            ) : null}
            <div className="pt-2">
              <div className="flex justify-between items-center py-2">
                <span className="font-semibold text-slate-700">Total estimé:</span>
                <span className="font-bold text-lg text-orange-600">{typeof order?.priceEstimate === 'number' ? `~${order.priceEstimate} CFA` : '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </RideBottomSheet>

      {/* Cancel policy modal */}
      {showCancel && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40" style={{ zIndex: 9999 }}>
          <div className="bg-white rounded-2xl shadow-xl w-[90%] max-w-sm p-4">
            <div className="text-base font-semibold text-slate-800">Annuler la commande ?</div>
            <p className="text-sm text-slate-600 mt-1">
              L'annulation peut entraîner des frais si le conducteur est proche de votre point de départ.
            </p>
            <ul className="text-xs text-slate-500 mt-2 space-y-1">
              <li>• Le conducteur sera notifié immédiatement</li>
              <li>• Vous pouvez reprogrammer depuis l'écran de commande</li>
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
      
      {/* Driver accepted modal */}
      {acceptedModal && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-[90%] max-w-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-5 h-5 text-orange-600" viewBox="0 0 24 24" fill="currentColor"><path d="M5 12a7 7 0 0 1 14 0v6a2 2 0 0 1-2 2h-3a1 1 0 0 1-1-1v-3H11v3a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2v-6Z"/></svg>
              <div className="text-base font-semibold text-slate-800">Commande acceptée</div>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Un conducteur vient d’accepter votre commande et est en route pour venir vous chercher.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAcceptedModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-2 text-sm"
              >OK</button>
              <button
                type="button"
                onClick={() => router.replace(`/trajet-en-cours?id=${encodeURIComponent(orderId || '')}`)}
                className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl py-2 text-sm"
              >Suivre</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CommandeAccepteePage() {
  return (
    <Suspense fallback={null}>
      <CommandeAccepteeContent />
    </Suspense>
  );
}
