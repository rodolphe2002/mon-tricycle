"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { quartiers as BUYO_QUARTIERS, distances as BUYO_DIST } from "../lib/buyoData";
import { fetchRoute } from "../lib/routing";
import TrajetSearchModal from "../components/TrajetSearchModal";
import RideBottomSheet from "../components/RideBottomSheet";
import { usePersistentState } from "../lib/persist";
import { useToast } from "../components/ToastProvider";

// Simple Haversine distance in km
function haversineKm(a, b) {
  if (!a || !b) return 0;
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export default function CommanderTrajetPage() {
  const router = useRouter();
  const toast = useToast();
  const [startText, setStartText] = usePersistentState("tri_cmd_start_text", "");
  const [destText, setDestText] = usePersistentState("tri_cmd_dest_text", "");

  const [startPoint, setStartPoint] = usePersistentState("tri_cmd_start_point", null); // {name, lat, lon}
  const [destPoint, setDestPoint] = usePersistentState("tri_cmd_dest_point", null);

  // Full-screen trip search modal (shared with /pre-commande)
  const [modalOpen, setModalOpen] = useState(false);
  // Bumps when the Leaflet map finishes initializing so effects depending on
  // mapRef/LRef re-run even if their other deps were already set.
  const [mapReady, setMapReady] = useState(false);

  // Observe container size changes and refresh map
  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;
    let ro;
    try {
      ro = new ResizeObserver(() => {
        try { ensureMapVisible(); } catch {}
      });
      ro.observe(el);
    } catch {}
    return () => {
      try { ro && ro.disconnect(); } catch {}
    };
  }, []);

  const [options, setOptions] = usePersistentState("tri_cmd_options", { promo: "", pax: 1, bags: 0, accessible: false });
  // Extend options with baggage offer and description
  useEffect(() => {
    // migrate persisted state if missing new fields
    setOptions((o) => ({ bagOffer: 0, bagDesc: "", ...o }));
  }, []);
  // Toggle to reveal baggage detail fields only when needed
  const [showBagDetails, setShowBagDetails] = useState(false);
  useEffect(() => {
    // Auto-show if there's already content, otherwise keep compact
    if ((Number(options.bagOffer) || 0) > 0 || (options.bagDesc || "").trim().length > 0) {
      setShowBagDetails(true);
    }
  }, [options.bagOffer, options.bagDesc]);
  // Clear baggage fields if bags set to 0
  useEffect(() => {
    if ((Number(options.bags) || 0) === 0) {
      setShowBagDetails(false);
      setOptions((o) => ({ ...o, bagOffer: 0, bagDesc: "" }));
    }
  }, [options.bags, setOptions]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  // Avoid hydration mismatches: only show dynamic client-derived values after mount
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => { setIsHydrated(true); }, []);

  // Leaflet map refs
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({ base: null, route: null, routeLabels: null, start: null, dest: null });
  const LRef = useRef(null); // Leaflet module once loaded

  // Trip patch shared with TrajetSearchModal
  const applyTrip = (patch) => {
    if ("startText" in patch) setStartText(patch.startText);
    if ("startPoint" in patch) setStartPoint(patch.startPoint);
    if ("destText" in patch) setDestText(patch.destText);
    if ("destPoint" in patch) setDestPoint(patch.destPoint);
  };

  // Bottom sheet metrics (positions the floating locate button above the sheet)
  const [sheetH, setSheetH] = useState(null); // px; null -> default 55%
  const [sheetDragging, setSheetDragging] = useState(false);
  const onSheetHeight = useCallback((h, d) => { setSheetH(h); setSheetDragging(d); }, []);

  // Fit map bounds with room for the floating bar (top) and the bottom sheet
  const fitTripBounds = (bounds) => {
    const map = mapRef.current;
    if (!map || !bounds) return;
    const bottomPad = typeof window !== "undefined" ? Math.round(window.innerHeight * 0.55) : 300;
    try { map.fitBounds(bounds, { paddingTopLeft: [24, 90], paddingBottomRight: [24, bottomPad] }); } catch {}
  };

  // Helper to ensure map renders correctly after UI interactions
  const ensureMapVisible = () => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;
    try {
      map.invalidateSize(false);
      // Force base tiles to redraw if available
      if (layersRef.current.base && typeof layersRef.current.base.redraw === 'function') {
        layersRef.current.base.redraw();
      }
      // If both points set, keep bounds; else gently recenter a tiny bit
      if (startPoint && destPoint) {
        const bounds = L.latLngBounds(
          L.latLng(startPoint.lat, startPoint.lon),
          L.latLng(destPoint.lat, destPoint.lon)
        );
        fitTripBounds(bounds);
      } else {
        // nudge to trigger tile draw
        map.panBy([0, 0], { animate: false });
      }
    } catch {}
  };

  // Auto-open the trip picker once if the trip is incomplete
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (!isHydrated || autoOpenedRef.current) return;
    if (!startPoint || !destPoint) {
      autoOpenedRef.current = true;
      setModalOpen(true);
    }
  }, [isHydrated, startPoint, destPoint]);

  // Try browser geolocation for start point
  const geoSupported = typeof navigator !== "undefined" && "geolocation" in navigator;
  const locateMe = () => {
    if (!geoSupported) { toast.error("La géolocalisation n'est pas disponible."); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setStartPoint({ name: "Ma position", lat, lon });
        setStartText("Ma position");
      },
      () => { toast.error("Impossible d'obtenir votre position."); },
      { enableHighAccuracy: true, timeout: 7000 }
    );
  };

  const distanceKm = useMemo(() => {
    if (!startPoint || !destPoint) return 0;
    const a = startPoint.name;
    const b = destPoint.name;
    if (a && b) {
      const d = (BUYO_DIST?.[a]?.[b]) ?? (BUYO_DIST?.[b]?.[a]);
      if (typeof d === "number" && d > 0) return d;
    }
    return haversineKm(startPoint, destPoint);
  }, [startPoint, destPoint]);

  // Invalidate on window resize/orientation changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onResize = () => { try { ensureMapVisible(); } catch {} };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);
  const avgSpeedKmh = 22; // assume average 22 km/h in city
  const durationMin = isHydrated && distanceKm ? Math.max(3, Math.round((distanceKm / avgSpeedKmh) * 60)) : 0;

  // Real road route (OSRM) — falls back to straight line if unavailable
  const [route, setRoute] = useState(null); // {coordinates, distanceKm, durationMin, fallback}
  const displayKm = route?.distanceKm ?? distanceKm;
  const displayMin = route?.durationMin ?? durationMin;

  // Pricing: 200 F par passager + offre bagages
  const baseOk = isHydrated && startPoint && destPoint && startPoint.name !== destPoint.name;
  const pax = Math.max(1, Math.min(6, Number(options.pax) || 1));
  const bagOffer = Math.max(0, Number(options.bagOffer) || 0);
  const price = baseOk ? 200 * pax + bagOffer : 0;

  const canOrder = !!(isHydrated && startPoint && destPoint && startPoint.name !== destPoint.name);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    let mounted = true;
    (async () => {
      const L = (await import("leaflet")).default;
      if (!mounted) return;
      LRef.current = L;

      // Center near Buyo (first quartier from dataset)
      const center = BUYO_QUARTIERS[0]?.coords || [6.2718, -6.9943];
      const map = L.map(mapContainerRef.current, { zoomControl: false }).setView(center, 14);
      const base = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
        updateWhenIdle: false,
        updateWhenZooming: true,
        keepBuffer: 2,
      }).addTo(map);
      // Make sure to refresh when tiles finish loading
      base.on("load", () => {
        try { map.invalidateSize(false); } catch {}
      });

      mapRef.current = map;
      layersRef.current.base = base;
      setMapReady(true);

      // Ensure tiles render after first mount
      setTimeout(() => {
        try { map.invalidateSize(false); } catch {}
      }, 0);
    })();

    return () => { mounted = false; };
  }, []);

  // Draw or update markers for chosen start/dest
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;

    // Compact endpoint pins: white circle, thick dark border, modal icon inside
    const pinIcon = (src, alt) =>
      L.divIcon({
        className: "",
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -14],
        tooltipAnchor: [0, -14],
        html: `<div style="width:30px;height:30px;border-radius:9999px;background:#fff;border:4px solid #1f2937;box-shadow:0 1px 5px rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center"><img src="${src}" alt="${alt}" style="width:15px;height:15px;display:block" /></div>`,
      });

    // Start marker
    if (layersRef.current.start) {
      layersRef.current.start.remove();
      layersRef.current.start = null;
    }
    if (startPoint) {
      layersRef.current.start = L.marker([startPoint.lat, startPoint.lon], { icon: pinIcon("/depart.png", "Départ") }).addTo(map).bindTooltip("Départ");
    }

    // Dest marker
    if (layersRef.current.dest) {
      layersRef.current.dest.remove();
      layersRef.current.dest = null;
    }
    if (destPoint) {
      layersRef.current.dest = L.marker([destPoint.lat, destPoint.lon], { icon: pinIcon("/destination.png", "Arrivée") }).addTo(map).bindTooltip("Arrivée");
    }

    // Fit bounds if both points are set
    if (startPoint && destPoint) {
      const bounds = L.latLngBounds(
        L.latLng(startPoint.lat, startPoint.lon),
        L.latLng(destPoint.lat, destPoint.lon)
      );
      fitTripBounds(bounds);
    }

    // After any marker/route change, ensure map reflows
    setTimeout(() => { try { ensureMapVisible(); } catch {} }, 0);
  }, [startPoint, destPoint, mapReady]);

  // Draw real road route (OSRM) between points; straight line as fallback
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;
    let cancelled = false;

    if (layersRef.current.route) {
      layersRef.current.route.remove();
      layersRef.current.route = null;
    }
    if (layersRef.current.routeLabels) {
      layersRef.current.routeLabels.forEach((l) => l.remove());
      layersRef.current.routeLabels = null;
    }
    if (!startPoint || !destPoint) {
      setRoute(null);
      return;
    }

    (async () => {
      const r = await fetchRoute(startPoint, destPoint);
      if (cancelled || !r) return;
      setRoute(r);
      try {
        layersRef.current.route = L.polyline(r.coordinates, {
          color: "#fb923c",
          weight: 5,
          opacity: 0.9,
          lineCap: "round",
          lineJoin: "round",
          dashArray: r.fallback ? "6 6" : null,
        }).addTo(map);
        fitTripBounds(L.latLngBounds(r.coordinates));

        // Route labels: distance on the line + ETA badge (white border, orange fill)
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
    })();

    return () => { cancelled = true; };
  }, [startPoint, destPoint, mapReady]);

  async function submitOrder() {
    if (!canOrder || submitting) return;
    setSubmitError("");
    setSubmitting(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("tri_token_client") : null;
      if (!token) {
        setSubmitError("Veuillez vous connecter pour commander.");
        setSubmitting(false);
        return;
      }

      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
      const payload = {
        start: startPoint ? { name: startPoint.name || startText || "", lat: startPoint.lat, lon: startPoint.lon } : null,
        destination: destPoint ? { name: destPoint.name || destText || "", lat: destPoint.lat, lon: destPoint.lon } : null,
        passengers: pax,
        bags: Math.max(0, Math.min(3, Number(options.bags) || 0)),
        bagOffer: Math.max(0, Number(options.bagOffer) || 0),
        bagDescription: (options.bagDesc || "").trim(),
        accessible: options.accessible,
        promoCode: options.promo || "",
        priceEstimate: Number(price) || 0,
      };

      const res = await fetch(`${apiBase}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        try {
          localStorage.removeItem('tri_token_client');
          localStorage.removeItem('tri_user_client');
        } catch {}
        router.replace('/login');
        return;
      }
      if (!res.ok) {
        throw new Error(data?.error || "Impossible d'enregistrer la commande");
      }

      const newId = data?.id || data?._id;
      try { if (newId) localStorage.setItem('tri_last_order_id', String(newId)); } catch {}
      
      // Reset all fields after successful order submission
      setStartText("");
      setDestText("");
      setStartPoint(null);
      setDestPoint(null);
      setOptions({ promo: "", pax: 1, bags: 0, accessible: false, bagOffer: 0, bagDesc: "" });
      setSubmitError("");
      
      if (newId) {
        router.push(`/commande-acceptee?id=${encodeURIComponent(newId)}`);
      } else {
        router.push('/commande-acceptee');
      }
    } catch (err) {
      setSubmitError(err?.message || "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-white">
      {/* Carte plein écran (isolate: les z-index internes de Leaflet restent sous la sheet) */}
      <div ref={mapContainerRef} className="absolute inset-0 isolate" />

      {/* Barre flottante : retour + trajet */}
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
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="pointer-events-auto flex-1 min-w-0 bg-white rounded-full shadow-md px-4 py-3 flex items-center gap-2 text-left"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="truncate text-sm font-medium text-slate-800">{startText || "Départ"}</span>
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
            <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
            <span className="truncate text-sm font-medium text-slate-800">{destText || "Destination"}</span>
          </button>
        </div>
      </div>

      {/* Bouton flottant : ma position */}
      <button
        type="button"
        onClick={locateMe}
        aria-label="Ma position"
        className="absolute right-4 z-[450] w-11 h-11 bg-white rounded-full shadow-md flex items-center justify-center text-slate-600"
        style={{ bottom: sheetH ? `${sheetH + 16}px` : "calc(55% + 16px)", transition: sheetDragging ? "none" : "bottom 0.25s ease-out" }}
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
      </button>

      {/* Bottom sheet */}
      <RideBottomSheet
        onHeightChange={onSheetHeight}
        footer={(
          <button
            disabled={!canOrder || submitting}
            className="w-full bg-orange-600 disabled:opacity-60 hover:bg-orange-700 text-white rounded-xl py-3 font-black tracking-wide text-lg shadow"
            onClick={submitOrder}
          >
            {submitting ? "Envoi..." : "Commander"}
          </button>
        )}
      >
            {/* En-tête : trajet + prix + stats */}
            <div className="flex items-start justify-between gap-3 pt-1">
              <div className="min-w-0">
                <div className="text-xs text-slate-500 truncate">
                  {startPoint?.name || "Départ"} → {destPoint?.name || "Destination"}
                </div>
                <div className="mt-1 text-3xl font-black text-slate-900">
                  {isHydrated && price ? `${price} CFA` : "—"}
                </div>
                <div className="text-sm text-slate-600 mt-0.5">
                  {isHydrated && displayKm ? `${displayKm.toFixed(1)} km` : "—"} • {isHydrated && displayMin ? `${displayMin} min` : "—"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                aria-label="Modifier le trajet"
                title="Modifier"
                className="shrink-0 w-10 h-10 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z" />
                </svg>
              </button>
            </div>


            {/* Options */}
            <div className="bg-slate-50 rounded-2xl p-3 space-y-3">
          <div className="text-sm font-medium text-slate-700">Options</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Passagers</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOptions((o) => ({ ...o, pax: Math.max(1, (Number(o.pax) || 1) - 1) }))}
                  disabled={pax <= 1}
                  aria-label="Moins de passagers"
                  className="w-8 h-8 rounded-full border border-slate-200 text-slate-600 disabled:opacity-40 flex items-center justify-center text-lg leading-none"
                >−</button>
                <span className="min-w-6 text-center font-semibold text-slate-800">{pax}</span>
                <button
                  type="button"
                  onClick={() => setOptions((o) => ({ ...o, pax: Math.min(6, (Number(o.pax) || 1) + 1) }))}
                  disabled={pax >= 6}
                  aria-label="Plus de passagers"
                  className="w-8 h-8 rounded-full border border-slate-200 text-slate-600 disabled:opacity-40 flex items-center justify-center text-lg leading-none"
                >+</button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Bagages</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOptions((o) => ({ ...o, bags: Math.max(0, (Number(o.bags) || 0) - 1) }))}
                  disabled={!options.bags}
                  aria-label="Moins de bagages"
                  className="w-8 h-8 rounded-full border border-slate-200 text-slate-600 disabled:opacity-40 flex items-center justify-center text-lg leading-none"
                >−</button>
                <span className="min-w-6 text-center font-semibold text-slate-800">{options.bags || 0}</span>
                <button
                  type="button"
                  onClick={() => {
                    const n = Math.min(3, (Number(options.bags) || 0) + 1);
                    setOptions((o) => ({ ...o, bags: n }));
                    if (n > 0) setShowBagDetails(true);
                  }}
                  disabled={(Number(options.bags) || 0) >= 3}
                  aria-label="Plus de bagages"
                  className="w-8 h-8 rounded-full border border-slate-200 text-slate-600 disabled:opacity-40 flex items-center justify-center text-lg leading-none"
                >+</button>
              </div>
            </div>
            {Number(options.bags) > 0 && !showBagDetails && (
              <div className="col-span-2">
                <button
                  type="button"
                  className="text-xs text-orange-700 hover:underline"
                  onClick={() => setShowBagDetails(true)}
                >Ajouter des détails de bagages</button>
              </div>
            )}
            {Number(options.bags) > 0 && showBagDetails && (
              <>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Offre bagages (CFA)</label>
                  <input
                    type="number"
                    min={0}
                    value={options.bagOffer ?? 0}
                    onChange={(e) => setOptions((o) => ({ ...o, bagOffer: Math.max(0, Number(e.target.value) || 0) }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-orange-400"
                    placeholder="Ex: 300"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Description des bagages</label>
                  <input
                    type="text"
                    value={options.bagDesc ?? ""}
                    onChange={(e) => setOptions((o) => ({ ...o, bagDesc: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-orange-400"
                    placeholder="Ex: 2 valises, fragile"
                  />
                </div>
              </>
            )}
          </div>
        </div>

            {submitError && (
              <div className="text-sm text-red-600">{submitError}</div>
            )}
      </RideBottomSheet>

      {/* Modale plein écran de recherche de trajet */}
      <TrajetSearchModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onDone={() => setModalOpen(false)}
        trip={{ startText, startPoint, destText, destPoint }}
        onChange={applyTrip}
      />
    </div>
  );
}
