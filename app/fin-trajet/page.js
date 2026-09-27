"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchRoute } from "../lib/routing";
import { useToast } from "../components/ToastProvider";
import RideBottomSheet from "../components/RideBottomSheet";

// Utils
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

function FinDeTrajetContent() {
  const router = useRouter();
  const params = useSearchParams();
  const orderId = params.get("id");
  const toast = useToast();

  // Payment can still come from query for now (no payment entity yet)
  const payment = params.get("pay") || "Espèces"; // Espèces / Wallet / Carte

  // Live order values
  const [km, setKm] = useState(null);
  const [min, setMin] = useState(null);
  const [price, setPrice] = useState(0);
  const [trip, setTrip] = useState(null); // { start, destination }
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Leaflet map
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({ base: null, pickup: null, dest: null, route: null });
  const LRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [sheetH, setSheetH] = useState(0);

  const onSheetHeight = useCallback((h) => setSheetH(h), []);

  // Ensure we have an orderId: fallback from localStorage and update URL if needed
  useEffect(() => {
    if (orderId) return;
    try {
      const saved = localStorage.getItem("tri_last_order_id");
      if (saved) router.replace(`/fin-trajet?id=${encodeURIComponent(saved)}`);
    } catch {}
  }, [orderId, router]);

  // Fetch order and compute km/min/price
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (!orderId) return;
        const base = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
        const token = localStorage.getItem("tri_token_client");
        if (!token) { router.replace("/login"); return; }
        const res = await fetch(`${base}/api/orders/${orderId}?t=${Date.now()}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          try { localStorage.removeItem('tri_token_client'); localStorage.removeItem('tri_user_client'); } catch {}
          router.replace('/login');
          return;
        }
        if (!res.ok) throw new Error(data?.error || 'Erreur de chargement');
        if (cancelled) return;
        const start = data?.start;
        const dest = data?.destination;
        if (start?.lat != null && dest?.lat != null) setTrip({ start, destination: dest });
        // Compute distance
        const dKm = (start && dest) ? haversineKm(start, dest) : 0;
        setKm(dKm);
        // Compute minutes: prefer actual ride duration
        const startedAt = data?.startedAt ? new Date(data.startedAt) : null;
        const completedAt = data?.completedAt ? new Date(data.completedAt) : null;
        if (startedAt && completedAt && completedAt > startedAt) {
          const ms = completedAt.getTime() - startedAt.getTime();
          setMin(Math.max(1, Math.round(ms / 60000)));
        } else {
          // Estimate from distance at ~22 km/h
          const speedKmh = 22;
          setMin(dKm ? Math.max(1, Math.round((dKm / speedKmh) * 60)) : 0);
        }
        // Price: use final or priceEstimate
        const p = typeof data?.priceEstimate === 'number' ? data.priceEstimate : Math.max(700, Math.round(300 + dKm * 180));
        setPrice(p);
      } catch (e) {
        if (!cancelled) setErr(e?.message || 'Erreur');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [orderId, router]);

  const [rating, setRating] = useState(5);
  const [tip, setTip] = useState(0);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [alreadyRated, setAlreadyRated] = useState(false);

  // Also fetch existing rating/review to prefill and lock UI if already rated
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (!orderId) return;
        const base = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
        const token = localStorage.getItem("tri_token_client");
        if (!token) return;
        const res = await fetch(`${base}/api/orders/${orderId}?t=${Date.now()}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (cancelled || !res.ok) return;
        if (typeof data?.rating === 'number' && data.rating >= 1) {
          setRating(Math.round(data.rating));
          setNotes(data?.review || "");
          setAlreadyRated(true);
        }
      } catch {}
    };
    load();
    return () => { cancelled = true; };
  }, [orderId]);

  // Init map once (same setup as the other VTC screens)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    let mounted = true;
    (async () => {
      const L = (await import('leaflet')).default;
      if (!mounted) return;
      LRef.current = L;
      const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([6.2718, -6.9943], 14);
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

  // Draw the completed trip: endpoint pins + road route, fitted above the sheet
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L || !trip?.start || !trip?.destination) return;
    let cancelled = false;

    const pinIcon = (src, alt) =>
      L.divIcon({
        className: "",
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -14],
        tooltipAnchor: [0, -14],
        html: `<div style="width:30px;height:30px;border-radius:9999px;background:#fff;border:4px solid #1f2937;box-shadow:0 1px 5px rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center"><img src="${src}" alt="${alt}" style="width:15px;height:15px;display:block" /></div>`,
      });

    try {
      layersRef.current.pickup = L.marker([trip.start.lat, trip.start.lon], { icon: pinIcon("/depart.png", "Départ") }).addTo(map).bindTooltip("Départ");
      layersRef.current.dest = L.marker([trip.destination.lat, trip.destination.lon], { icon: pinIcon("/destination.png", "Arrivée") }).addTo(map).bindTooltip("Arrivée");
    } catch {}

    (async () => {
      const r = await fetchRoute(trip.start, trip.destination);
      if (cancelled || !r) return;
      try {
        layersRef.current.route = L.polyline(r.coordinates, {
          color: "#fb923c",
          weight: 5,
          opacity: 0.9,
          lineCap: "round",
          lineJoin: "round",
          dashArray: r.fallback ? "6 6" : null,
        }).addTo(map);
        const bottomPad = Math.max(120, Math.round((sheetH || 0) * 0.9));
        map.fitBounds(L.latLngBounds(r.coordinates), { paddingTopLeft: [24, 90], paddingBottomRight: [24, bottomPad] });
      } catch {}
    })();

    return () => { cancelled = true; };
  }, [trip, mapReady, sheetH]);

  // Helper to persist finalization (tip, payment, receipt prefs)
  const finalizeOrder = async (opts = {}) => {
    if (!orderId) return;
    const base = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
    const token = localStorage.getItem("tri_token_client");
    if (!token) { router.replace('/login'); return; }
    const body = {
      tip: Number(tip) || 0,
      paymentMethod: payment,
    };
    if (opts.receiptRequested) body.receiptRequested = opts.receiptRequested;
    if (opts.receiptEmail) body.receiptEmail = opts.receiptEmail;
    await fetch(`${base}/api/orders/${orderId}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  };

  const total = useMemo(() => (Number(price) || 0) + (Number(tip) || 0), [price, tip]);

  // Helper: submit rating/review once
  const submitRatingIfNeeded = async () => {
    if (!orderId) return;
    const base = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
    const token = localStorage.getItem("tri_token_client");
    if (!token) { router.replace('/login'); return; }
    if (!alreadyRated && rating >= 1 && rating <= 5) {
      await fetch(`${base}/api/orders/${orderId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rating, review: notes }),
      });
      setAlreadyRated(true);
    }
  };

  const sendReceipt = async () => {
    try {
      toast.info('Téléchargement du reçu en cours...');
      await downloadPdfReceipt();
    } catch {
      toast.error("Téléchargement du reçu impossible.");
    }
  };

  const downloadPdfReceipt = async () => {
    if (!orderId) return;
    const base = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
    const token = localStorage.getItem("tri_token_client");
    if (!token) { router.replace('/login'); return; }
    const url = `${base}/api/orders/${orderId}/receipt.pdf`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Reçu indisponible');
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `recu-tricycle-${orderId.slice(-6)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  };

  const goHistory = async () => {
    try { await submitRatingIfNeeded(); } catch {}
    try { await finalizeOrder(); } catch {}
    router.push("/historique");
  };

  const finish = async () => {
    try {
      if (!orderId) { router.push('/'); return; }
      setSubmitting(true);
      const token = localStorage.getItem("tri_token_client");
      if (!token) { router.replace('/login'); return; }
      // Submit rating only if not already rated
      await submitRatingIfNeeded();
      // Persist tip/payment
      try { await finalizeOrder(); } catch {}
      toast.success("Merci pour votre course !");
      router.push("/");
    } catch {
      toast.error("Envoi de la note impossible. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-white">
      {/* Carte plein écran : contexte du trajet terminé */}
      <div ref={mapContainerRef} className="absolute inset-0 isolate" />

      {/* Barre flottante : état du trajet */}
      <div className="absolute top-0 inset-x-0 z-[500] pointer-events-none">
        <div className="max-w-md mx-auto px-3 pt-3 flex justify-center">
          <div className="pointer-events-auto bg-white rounded-full shadow-md px-4 py-2.5 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
            <span className="text-sm font-medium text-slate-700">Trajet terminé</span>
          </div>
        </div>
      </div>

      {/* Bottom sheet : élément principal de l'écran */}
      <RideBottomSheet
        initialPct={0.62}
        onHeightChange={onSheetHeight}
        footer={(
          <button
            type="button"
            onClick={finish}
            disabled={submitting}
            className="w-full bg-orange-600 disabled:opacity-60 hover:bg-orange-700 text-white rounded-xl py-3 font-black tracking-wide text-lg shadow"
          >
            {submitting ? "Envoi..." : "Terminer"}
          </button>
        )}
      >
        {/* État principal */}
        <div className="pt-1">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
            <span className="text-base font-bold text-slate-800">Fin de trajet</span>
          </div>
          <div className="text-xs text-slate-500 truncate mt-1 pl-8">
            {trip?.start?.name || 'Départ'} → {trip?.destination?.name || 'Destination'}
          </div>
        </div>

        {/* Résumé du trajet */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="text-sm font-semibold text-slate-700">Résumé du trajet</div>
          <div className="divide-y divide-slate-100 text-sm">
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-600">Distance</span>
              <span className="font-medium text-slate-900">{km != null ? `${km.toFixed(1)} km` : '—'}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-600">Durée</span>
              <span className="font-medium text-slate-900">{min != null ? `${min} min` : '—'}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-600">Paiement</span>
              <span className="font-medium text-slate-900">{payment || '—'}</span>
            </div>
          </div>
        </div>

        {/* Prix + pourboire + total */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Prix</span>
            <span className="text-xl font-black text-slate-900">{loading ? '—' : `${Number(price) || 0} CFA`}</span>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-2">Pourboire</div>
            <div className="grid grid-cols-4 gap-2">
              {[0, 100, 200, 500].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTip(v)}
                  className={`rounded-xl py-2 text-sm font-medium transition-colors ${tip === v ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {v === 0 ? 'Aucun' : `+${v}`}
                </button>
              ))}
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="font-semibold text-slate-700">Total</span>
            <span className="text-2xl font-black text-orange-600">{total} CFA</span>
          </div>
        </div>

        {/* Notation conducteur */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="text-sm font-semibold text-slate-700 mb-2">Noter le conducteur</div>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setRating(s)}
                disabled={alreadyRated}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-colors ${s <= rating ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'} ${alreadyRated ? 'opacity-60' : ''}`}
                aria-label={`${s} étoiles`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={alreadyRated}
            placeholder="Un commentaire pour améliorer l'expérience…"
            className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-slate-50"
            rows={3}
          />
        </div>

        {/* Reçu + historique */}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={sendReceipt} className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-3 text-sm font-medium">Reçu PDF</button>
          <button type="button" onClick={goHistory} className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-3 text-sm font-medium">Historique</button>
        </div>

        {err ? <div className="text-sm text-red-600">{err}</div> : null}
      </RideBottomSheet>
    </div>
  );
}

export default function FinDeTrajetPage() {
  return (
    <Suspense fallback={null}>
      <FinDeTrajetContent />
    </Suspense>
  );
}
