"use client";

// app/lib/places.js
// Shared places dataset & suggestion helpers for trip pickers

import { useEffect, useMemo, useState } from "react";
import { quartiers as BUYO_QUARTIERS } from "./buyoData";
import { fetchBuyoPlaces, fetchHealthPOIs, fetchTransportPOIs, fetchSportsPOIs } from "./overpass";
import { geocodeSearch } from "./geocode";

// Accent-insensitive, case-insensitive normalization for matching/dedupe
export const normName = (s) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();


const BUYO_PLACES = BUYO_QUARTIERS.map((q) => ({
  name: q.name,
  lat: q.coords[0],
  lon: q.coords[1],
  source: "quartier",
}));

// Static fallback POIs to always include
const FALLBACK_POIS = [
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
].map((p) => ({ ...p, source: "poi" }));

// Loads quartiers (Buyo first) + Overpass POIs + static fallbacks, deduped
export function usePlaces() {
  const [overpassPlaces, setOverpassPlaces] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const center = BUYO_QUARTIERS[0]?.coords || [6.2718, -6.9943];
        const dLat = 0.07;
        const dLon = 0.07;
        const bbox = {
          south: center[0] - dLat,
          west: center[1] - dLon,
          north: center[0] + dLat,
          east: center[1] + dLon,
        };
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
          ...FALLBACK_POIS,
        ];
        const seen = new Set();
        const norm = [];
        for (const p of all) {
          const k = normName(p?.name);
          if (!k || seen.has(k)) continue;
          seen.add(k);
          norm.push({ name: p.name, lat: p.lat, lon: p.lon, source: p.source || "poi" });
        }
        if (mounted) setOverpassPlaces(norm);
      } catch {
        if (mounted) setOverpassPlaces(FALLBACK_POIS);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const p of BUYO_PLACES) {
      const k = normName(p.name);
      if (!seen.has(k)) { seen.add(k); list.push(p); }
    }
    for (const p of overpassPlaces) {
      const k = normName(p.name);
      if (!seen.has(k)) { seen.add(k); list.push(p); }
    }
    return list;
  }, [overpassPlaces]);
}

// Debounced Nominatim remote suggestions for a query string
export function useRemoteSuggestions(text, { limit = 5 } = {}) {
  const [remote, setRemote] = useState([]);

  useEffect(() => {
    const q = (text || "").trim();
    if (!q || q.length < 2) { setRemote([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await geocodeSearch(q, { limit, country: "ci", lang: "fr" });
        if (!ctrl.signal.aborted) setRemote(res);
      } catch {
        if (!ctrl.signal.aborted) setRemote([]);
      }
    }, 350);
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [text, limit]);

  return remote;
}

// Merge filtered local places + remote results (prefix matches first, dedup by name)
export function buildSuggestions(text, places, remote, { limit = 12 } = {}) {
  const q = normName(text);
  let local = q ? places.filter((p) => normName(p.name).includes(q)) : places;
  if (q) {
    local = [...local].sort((a, b) => {
      const pa = normName(a.name).startsWith(q) ? 0 : 1;
      const pb = normName(b.name).startsWith(q) ? 0 : 1;
      return pa - pb;
    });
  }
  const seen = new Set(local.map((p) => normName(p.name)));
  const remoteItems = (remote || [])
    .map((r) => {
      const full = r.name || "";
      const parts = full.split(",");
      const short = (parts[0] || full).trim();
      const detail = parts.slice(1).map((s) => s.trim()).filter(Boolean).join(", ");
      const a = r.address || {};
      // Nicer locality line from structured address when available
      const locality = [a.suburb, a.neighbourhood, a.village, a.town, a.city, a.county].filter(Boolean).join(", ");
      return {
        name: short,
        detail: locality || detail,
        lat: r.lat,
        lon: r.lon,
        source: "nominatim",
        category: r.category || null,
        type: r.type || null,
      };
    })
    .filter((r) => r.lat && r.lon && !seen.has(normName(r.name)));
  return [...local, ...remoteItems].slice(0, limit);
}
