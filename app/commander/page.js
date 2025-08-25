"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { quartiers as BUYO_QUARTIERS, distances as BUYO_DIST } from "../lib/buyoData";
import { geocodeSearch } from "../lib/geocode";
import { fetchBuyoPlaces, fetchHealthPOIs, fetchTransportPOIs, fetchSportsPOIs } from "../lib/overpass";
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

// Build datasets from shared Buyo data
const PLACES = BUYO_QUARTIERS.map((q) => ({ name: q.name, lat: q.coords[0], lon: q.coords[1] }));

const QUARTIERS = PLACES;

export default function CommanderTrajetPage() {
  const router = useRouter();
  const toast = useToast();
  const [startText, setStartText] = usePersistentState("tri_cmd_start_text", "");
  const [destText, setDestText] = usePersistentState("tri_cmd_dest_text", "");

  const [startPoint, setStartPoint] = usePersistentState("tri_cmd_start_point", null); // {name, lat, lon}
  const [destPoint, setDestPoint] = usePersistentState("tri_cmd_dest_point", null);

  const [showStartSuggest, setShowStartSuggest] = useState(false);
  const [showDestSuggest, setShowDestSuggest] = useState(false);
  const hideBelow = showStartSuggest || showDestSuggest;

  // Remote suggestions from Nominatim (debounced)
  const [startRemote, setStartRemote] = useState([]);
  const [destRemote, setDestRemote] = useState([]);

  // Overpass places (fetched once, merged after our Buyo quartiers)
  const [overpassPlaces, setOverpassPlaces] = useState([]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const center = BUYO_QUARTIERS[0]?.coords || [6.2718, -6.9943];
        const dLat = 0.07; // ~7.7 km
        const dLon = 0.07; // ~7.7 km (approx)
        const bbox = { south: center[0] - dLat, west: center[1] - dLon, north: center[0] + dLat, east: center[1] + dLon };
        const [placesRes, healthRes, transportRes, sportsRes] = await Promise.all([
          fetchBuyoPlaces({ bbox }),
          fetchHealthPOIs({ bbox }),
          fetchTransportPOIs({ bbox }),
          fetchSportsPOIs({ bbox }),
        ]);
        const all = [
          ...(placesRes || []),
          ...(healthRes || []),
          ...(transportRes || []),
          ...(sportsRes || []),
        ];
        // Normalize & dedupe by normalized name
        const seen = new Set();
        const norm = [];
        for (const p of all) {
          const n = (p?.name || "").trim().toLowerCase();
          if (!n || seen.has(n)) continue;
          seen.add(n);
          norm.push({ name: p.name, lat: p.lat, lon: p.lon });
        }
        // Static fallback POIs to always include
        const fallbackPOIs = [
          { name: "Nouvelle pharmacie de la cité", lat: 6.2497885, lon: -7.0095977 },
          { name: "MARCHE DE POISSONS FRAIS DE BUYO", lat: 6.2504168, lon: -7.0070812 },
          { name: "Pharmacie la colombe", lat: 6.2509553, lon: -7.0043959 },
          { name: "Coopec", lat: 6.2503637, lon: -7.0066859 },
          { name: "Maquis Zenith", lat: 6.2500036, lon: -7.0053988 },
          { name: "Petro ivoire", lat: 6.2501545, lon: -7.0051289 },
          { name: "Cité CIE", lat: 6.2472010, lon: -7.0159986 },
          { name: "Hotel de la Cité CIE", lat: 6.2489965, lon: -7.0148988 },
          { name: "Restaurant du Club CIE", lat: 6.2483640, lon: -7.0153962 },
          { name: "Château d'eau", lat: 6.2496993, lon: -7.0123948 },
          { name: "Eglise methodiste unie", lat: 6.2493330, lon: -7.0120985 },
          { name: "Église évangélique Reveil de Côte d'Ivoire de Buyo", lat: 6.2523922, lon: -7.0049618 },
          { name: "EPP Buyo barrage", lat: 6.2518357, lon: -7.0038367 },
          { name: "Tchemansso", lat: 6.2591966, lon: -6.9969439 },
          { name: "College saint andre de buyo", lat: 6.2569511, lon: -6.9990182 },
          { name: "Belleville", lat: 6.2445363, lon: -7.0011871 },
          { name: "Boulangerie", lat: 6.2528853, lon: -7.0031654 },
          { name: "Église évangélique Assemblée de Dieu buyo", lat: 6.2554396, lon: -7.0028642 },
          { name: "Église CMA", lat: 6.2539057, lon: -7.0023764 },
          { name: "Gare issia", lat: 6.2537068, lon: -7.0033678 },
          { name: "CIE Arrondissement de Buyo", lat: 6.2460962, lon: -7.0163914 },
          { name: "Hôtel de ville de buyo", lat: 6.2764805, lon: -6.9952467 },
          { name: "Trésorerie", lat: 6.2754220, lon: -6.9962701 },
          { name: "Buyo Lac", lat: 6.2541005, lon: -7.0059332 },
          { name: "Buyo Cité", lat: 6.2470336, lon: -7.0074645 },
          { name: "Djinansso", lat: 6.2794410, lon: -6.9903528 },
        ];
        for (const f of fallbackPOIs) {
          const k = (f.name || "").trim().toLowerCase();
          if (k && !seen.has(k)) {
            seen.add(k);
            norm.push(f);
          }
        }
        if (mounted) setOverpassPlaces(norm);
      } catch {
        if (mounted) setOverpassPlaces([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

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

  // Markers effect moved below after LOCAL_PLACES declaration

  // Merge local Buyo quartiers with Overpass results (Buyo first), dedup by name
  const LOCAL_PLACES = useMemo(() => {
    const norm = (s) => (s || "").trim().toLowerCase();
    const seen = new Set();
    const list = [];
    for (const p of PLACES) { const k = norm(p.name); if (!seen.has(k)) { seen.add(k); list.push(p); } }
    for (const p of overpassPlaces) { const k = norm(p.name); if (!seen.has(k)) { seen.add(k); list.push(p); } }
    return list;
  }, [overpassPlaces]);

  // Rebuild markers for all LOCAL_PLACES (quartiers + Overpass POIs)
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;
    // Clear existing markers
    if (layersRef.current.quartierMarkers && layersRef.current.quartierMarkers.length) {
      for (const m of layersRef.current.quartierMarkers) {
        try { m.remove(); } catch {}
      }
      layersRef.current.quartierMarkers = [];
    }
    // Build new markers
    const markers = (LOCAL_PLACES || []).map((q) => {
      const m = L.marker([q.lat, q.lon]).addTo(map).bindPopup(q.name);
      m.on("click", () => {
        if (!startPoint) {
          setStartPoint(q);
          setStartText(q.name);
        } else if (!destPoint) {
          setDestPoint(q);
          setDestText(q.name);
        } else {
          setStartPoint(q);
          setStartText(q.name);
          setDestPoint(null);
          setDestText("");
        }
      });
      return m;
    });
    layersRef.current.quartierMarkers = markers;
  }, [LOCAL_PLACES, startPoint, destPoint]);

  // Normalize helper for dedupe
  const normName = (s) => (s || "").trim().toLowerCase();

  // Debounced fetch for start
  useEffect(() => {
    const q = startText.trim();
    if (!q || q.length < 2) { setStartRemote([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await geocodeSearch(q, { limit: 5, country: "ci", lang: "fr" });
        if (!ctrl.signal.aborted) setStartRemote(res);
      } catch {
        if (!ctrl.signal.aborted) setStartRemote([]);
      }
    }, 350);
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [startText]);

  // Debounced fetch for dest
  useEffect(() => {
    const q = destText.trim();
    if (!q || q.length < 2) { setDestRemote([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await geocodeSearch(q, { limit: 5, country: "ci", lang: "fr" });
        if (!ctrl.signal.aborted) setDestRemote(res);
      } catch {
        if (!ctrl.signal.aborted) setDestRemote([]);
      }
    }, 350);
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [destText]);

  const [options, setOptions] = usePersistentState("tri_cmd_options", { promo: "", pax: 1, bags: 0, accessible: false });
  // Extend options with baggage offer and description
  useEffect(() => {
    // migrate persisted state if missing new fields
    setOptions((o) => ({ bagOffer: 0, bagDesc: "", ...o }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Toggle to reveal baggage detail fields only when needed
  const [showBagDetails, setShowBagDetails] = useState(false);
  useEffect(() => {
    // Auto-show if there's already content, otherwise keep compact
    if ((Number(options.bagOffer) || 0) > 0 || (options.bagDesc || "").trim().length > 0) {
      setShowBagDetails(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
  const layersRef = useRef({ base: null, route: null, start: null, dest: null, quartierMarkers: [] });
  const LRef = useRef(null); // Leaflet module once loaded
  const IconRef = useRef(null); // Default marker icon once created

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
        map.fitBounds(bounds, { padding: [30, 30] });
      } else {
        // nudge to trigger tile draw
        map.panBy([0, 0], { animate: false });
      }
    } catch {}
  };

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

  // Filter suggestions
  const startSuggestions = useMemo(() => {
    const q = startText.trim().toLowerCase();
    const local = q ? LOCAL_PLACES.filter((p) => p.name.toLowerCase().includes(q)) : LOCAL_PLACES.slice(0, 6);
    // Merge remote (without duplicate names, normalized)
    const seen = new Set(local.map((p) => normName(p.name)));
    const remoteNorm = (startRemote || []).filter((r) => r.lat && r.lon && !seen.has(normName(r.name)));
    const merged = [...local, ...remoteNorm].slice(0, 8);
    return merged;
  }, [startText, startRemote, LOCAL_PLACES]);

  const destSuggestions = useMemo(() => {
    const q = destText.trim().toLowerCase();
    const local = q ? LOCAL_PLACES.filter((p) => p.name.toLowerCase().includes(q)) : LOCAL_PLACES.slice(0, 6);
    const seen = new Set(local.map((p) => normName(p.name)));
    const remoteNorm = (destRemote || []).filter((r) => r.lat && r.lon && !seen.has(normName(r.name)));
    const merged = [...local, ...remoteNorm].slice(0, 8);
    return merged;
  }, [destText, destRemote, LOCAL_PLACES]);

  // Close suggestion lists when clicking outside
  const startBoxRef = useRef(null);
  const destBoxRef = useRef(null);
  const startInputRef = useRef(null);
  const destInputRef = useRef(null);
  useEffect(() => {
    function onDocDown(e) {
      const sIn = startBoxRef.current && startBoxRef.current.contains(e.target);
      const dIn = destBoxRef.current && destBoxRef.current.contains(e.target);
      if (!sIn) setShowStartSuggest(false);
      if (!dIn) setShowDestSuggest(false);
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("touchstart", onDocDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("touchstart", onDocDown);
    };
  }, []);

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

  // Ensure map redraw after layout changes (e.g., suggestion panels open/close)
  useEffect(() => {
    // Delay a bit to let DOM layout settle
    const t = setTimeout(() => { try { ensureMapVisible(); } catch {} }, 100);
    return () => clearTimeout(t);
  }, [showStartSuggest, showDestSuggest, startText, destText]);

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

  // Pricing: 200 F par passager + offre bagages
  const baseOk = isHydrated && startPoint && destPoint && startPoint.name !== destPoint.name;
  const pax = Math.max(1, Math.min(3, Number(options.pax) || 1));
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

      // Configure default Leaflet marker icons (avoid 404s in Next.js)
      const DefaultIcon = L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        tooltipAnchor: [16, -28],
        shadowSize: [41, 41],
      });
      L.Marker.prototype.options.icon = DefaultIcon;
      IconRef.current = DefaultIcon;

      // Center near Buyo (first quartier from dataset)
      const center = BUYO_QUARTIERS[0]?.coords || [6.2718, -6.9943];
      const map = L.map(mapContainerRef.current).setView(center, 14);
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

      // Add quartier markers
      const markers = QUARTIERS.map((q) => {
        const m = L.marker([q.lat, q.lon]).addTo(map).bindPopup(q.name);
        m.on("click", () => {
          if (!startPoint) {
            setStartPoint({ name: q.name, lat: q.lat, lon: q.lon });
            setStartText(q.name);
          } else if (!destPoint) {
            setDestPoint({ name: q.name, lat: q.lat, lon: q.lon });
            setDestText(q.name);
          } else {
            // Reset cycle: start <- clicked, dest cleared
            setStartPoint({ name: q.name, lat: q.lat, lon: q.lon });
            setStartText(q.name);
            setDestPoint(null);
            setDestText("");
          }
        });
        return m;
      });

      layersRef.current.quartierMarkers = markers;
      mapRef.current = map;
      layersRef.current.base = base;

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
    const DefaultIcon = IconRef.current;
    if (!map || !L) return;

    // Start marker
    if (layersRef.current.start) {
      layersRef.current.start.remove();
      layersRef.current.start = null;
    }
    if (startPoint && DefaultIcon) {
      layersRef.current.start = L.marker([startPoint.lat, startPoint.lon], { icon: DefaultIcon }).addTo(map).bindTooltip("Départ");
    }

    // Dest marker
    if (layersRef.current.dest) {
      layersRef.current.dest.remove();
      layersRef.current.dest = null;
    }
    if (destPoint && DefaultIcon) {
      layersRef.current.dest = L.marker([destPoint.lat, destPoint.lon], { icon: DefaultIcon }).addTo(map).bindTooltip("Arrivée");
    }

    // Fit bounds if both points are set
    if (startPoint && destPoint) {
      const bounds = L.latLngBounds(
        L.latLng(startPoint.lat, startPoint.lon),
        L.latLng(destPoint.lat, destPoint.lon)
      );
      map.fitBounds(bounds, { padding: [30, 30] });
    }

    // After any marker/route change, ensure map reflows
    setTimeout(() => { try { ensureMapVisible(); } catch {} }, 0);
  }, [startPoint, destPoint]);

  // Draw straight route between points and compute distance (as fallback when no router service)
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;
    if (layersRef.current.route) {
      layersRef.current.route.remove();
      layersRef.current.route = null;
    }
    if (startPoint && destPoint) {
      layersRef.current.route = L.polyline(
        [
          [startPoint.lat, startPoint.lon],
          [destPoint.lat, destPoint.lon],
        ],
        { color: "#fb923c", weight: 4 }
      ).addTo(map);
    }
  }, [startPoint, destPoint]);

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
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
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
              <span className="font-bold text-slate-800">Commander un trajet</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        {/* Start input */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
          <label className="text-xs text-slate-500">Point de départ</label>
          <div className="mt-1 relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"/></svg>
            </span>
            <input
              ref={startInputRef}
              value={startText}
              onChange={(e) => { setStartText(e.target.value); setShowStartSuggest(true); }}
              onFocus={() => { setShowStartSuggest(true); setShowDestSuggest(false); setTimeout(() => { try { ensureMapVisible(); } catch {} }, 0); }}
              onBlur={() => setTimeout(() => { setShowStartSuggest(false); ensureMapVisible(); }, 140)}
              onKeyDown={(e) => { if (e.key === "Escape") { setShowStartSuggest(false); e.currentTarget.blur(); } }}
              className="w-full rounded-xl border border-slate-200 pl-10 pr-28 py-3 outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="Votre position ou une adresse"
            />
            <button type="button" onClick={locateMe} className="absolute right-2 top-1/2 -translate-y-1/2 text-orange-700 text-sm bg-orange-50 hover:bg-orange-100 rounded-lg px-3 py-1">
              Ma position
            </button>
            {showStartSuggest && (
              <div
                className="absolute z-10 mt-2 left-0 right-0 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden"
                onMouseDown={(e) => e.preventDefault()} // keep input focused while clicking options
              >
                {startSuggestions.map((p) => (
                  <button
                    key={`${p.name}-${p.lat}-${p.lon}`}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setStartPoint(p); setStartText(p.name); setShowStartSuggest(false); setTimeout(ensureMapVisible, 0); }}
                    onTouchStart={(e) => { /* do not preventDefault in passive listeners */ e.stopPropagation(); setStartPoint(p); setStartText(p.name); setShowStartSuggest(false); setTimeout(ensureMapVisible, 0); }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-400" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"/></svg>
                    <span className="text-sm text-slate-700">{p.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Destination input */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
          <label className="text-xs text-slate-500">Destination</label>
          <div className="mt-1 relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"/></svg>
            </span>
            <input
              ref={destInputRef}
              value={destText}
              onChange={(e) => { setDestText(e.target.value); setShowDestSuggest(true); }}
              onFocus={() => { setShowDestSuggest(true); setShowStartSuggest(false); setTimeout(() => { try { ensureMapVisible(); } catch {} }, 0); }}
              onBlur={() => setTimeout(() => { setShowDestSuggest(false); ensureMapVisible(); }, 140)}
              onKeyDown={(e) => { if (e.key === "Escape") { setShowDestSuggest(false); e.currentTarget.blur(); } }}
              className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="Où allons-nous ?"
            />
            {showDestSuggest && (
              <div
                className="absolute z-10 mt-2 left-0 right-0 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden"
                onMouseDown={(e) => e.preventDefault()} // keep input focused while clicking options
              >
                {destSuggestions.map((p) => (
                  <button
                    key={`${p.name}-${p.lat}-${p.lon}`}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setDestPoint(p); setDestText(p.name); setShowDestSuggest(false); setTimeout(ensureMapVisible, 0); }}
                    onTouchStart={(e) => { /* do not preventDefault in passive listeners */ e.stopPropagation(); setDestPoint(p); setDestText(p.name); setShowDestSuggest(false); setTimeout(ensureMapVisible, 0); }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-400" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"/></svg>
                    <span className="text-sm text-slate-700">{p.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Map + route (Leaflet) */}
        <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-3 ${hideBelow ? "hidden" : ""}`}>
          <div className="text-xs text-slate-500 mb-2">Itinéraire estimé</div>
          <div className="w-full h-64 rounded-xl overflow-hidden">
            <div ref={mapContainerRef} className="w-full h-64" />
          </div>
          <div className="mt-2 flex items-center justify-between text-sm text-slate-700">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-500" fill="currentColor"><path d="M12 8a1 1 0 0 1 1 1v3.38l2.24 1.29a1 1 0 1 1-1 1.74l-2.74-1.58A1 1 0 0 1 11 13V9a1 1 0 0 1 1-1Zm0-6a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z"/></svg>
              <span>{isHydrated && distanceKm ? `${distanceKm.toFixed(1)} km` : "—"}</span>
              <span>•</span>
              <span>{isHydrated && durationMin ? `${durationMin} min` : "—"}</span>
            </div>
            <div className="font-semibold text-slate-900">{isHydrated && price ? `${price} CFA` : "—"}</div>
          </div>
        </div>

        {/* Options */}
        <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-3 ${hideBelow ? "hidden" : ""}`}>
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-500" fill="currentColor"><path d="M12 3a9 9 0 1 0 9 9A9.01 9.01 0 0 0 12 3Zm1 5a1 1 0 0 1 2 0v2h2a1 1 0 1 1 0 2h-2v2a1 1 0 1 1-2 0v-2h-2a1 1 0 0 1 0-2h2Z"/></svg>
            <span className="text-sm font-medium text-slate-700">Options</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Code promo</label>
              <input
                value={options.promo}
                onChange={(e) => setOptions((o) => ({ ...o, promo: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="TRI2025"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Passagers</label>
              <input
                type="number"
                min={1}
                max={3}
                value={options.pax}
                onChange={(e) => setOptions((o) => ({ ...o, pax: Number(e.target.value) }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Bagages</label>
              <input
                type="number"
                min={0}
                max={3}
                value={options.bags}
                onChange={(e) => {
                  const bags = Number(e.target.value);
                  setOptions((o) => ({ ...o, bags, bagOffer: bags > 0 ? o.bagOffer : 0, bagDesc: bags > 0 ? o.bagDesc : "" }));
                  setShowBagDetails(bags > 0);
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-orange-400"
              />
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
            <label className="flex items-center gap-2 mt-5">
              <input type="checkbox" checked={options.accessible} onChange={(e) => setOptions((o) => ({ ...o, accessible: e.target.checked }))} />
              <span>Accessibilité</span>
            </label>
          </div>
        </div>

        {/* Order button */}
        <div className={hideBelow ? "hidden" : ""}>
          <button
            disabled={!canOrder || submitting}
            className="w-full bg-orange-600 disabled:opacity-60 hover:bg-orange-700 text-white rounded-[999px] py-3 font-semibold shadow"
            onClick={submitOrder}
          >
            {submitting ? "Envoi..." : isHydrated && price ? `Commander • Total ~${price} CFA` : "Commander"}
          </button>
          {submitError && (
            <div className="text-sm text-red-600 mt-2">{submitError}</div>
          )}
        </div>
      </div>

      <div className="h-8" />
    </div>
  );
}

function SvgMiniMap({ start, dest }) {
  const w = 600; // internal viewBox width
  const h = 260; // internal viewBox height

  let startPt = null;
  let destPt = null;
  if (start) startPt = projectToViewBox(start, w, h);
  if (dest) destPt = projectToViewBox(dest, w, h);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* background grid */}
      <defs>
        <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#e5e7eb" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="#f1f5f9" />
      <rect width="100%" height="100%" fill="url(#grid)" />

      {/* route line */}
      {startPt && destPt && (
        <g>
          <path d={`M ${startPt.x} ${startPt.y} L ${destPt.x} ${destPt.y}`} stroke="#fb923c" strokeWidth="4" strokeLinecap="round" fill="none" />
        </g>
      )}

      {/* start pin */}
      {startPt && (
        <g transform={`translate(${startPt.x}, ${startPt.y})`}>
          <circle r="6" fill="#22c55e" />
          <circle r="2" fill="white" />
        </g>
      )}

      {/* dest pin */}
      {destPt && (
        <g transform={`translate(${destPt.x}, ${destPt.y})`}>
          <circle r="6" fill="#ef4444" />
          <circle r="2" fill="white" />
        </g>
      )}
    </svg>
  );
}
