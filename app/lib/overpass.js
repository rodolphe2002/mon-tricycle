// app/lib/overpass.js
// Minimal Overpass API client to fetch places within Buyo area or a bounding box

// Prefer multiple mirrors; we'll rotate with retries to reduce 504/429 impact
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  // Additional mirrors (kept after kumi due to variable reliability)
  "https://overpass.openstreetmap.fr/api/interpreter",
];

// Post a query with retries and a client-side timeout using AbortController
async function postOverpassWithRetries(query, { retries = 2, timeoutMs = 20000 } = {}) {
  const body = new URLSearchParams({ data: query });
  let lastErr;

  for (let attempt = 0; attempt <= retries; attempt++) {
    // Rotate endpoints each attempt
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length];
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(new Error("client-timeout")), timeoutMs);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: ac.signal,
      });
      clearTimeout(t);
      if (!res.ok) {
        // Retry on 429/5xx/504; otherwise return empty
        if (res.status === 429 || res.status === 504 || res.status >= 500) {
          lastErr = new Error(`HTTP ${res.status}`);
        } else {
          return null;
        }
      } else {
        return await res.json();
      }
    } catch (err) {
      clearTimeout(t);
      lastErr = err;
    }
    // Exponential backoff between attempts
    const backoff = 400 * Math.pow(2, attempt);
    await new Promise((r) => setTimeout(r, backoff));
  }
  if (!(typeof navigator !== "undefined" && navigator.onLine === false)) {
    console.warn("Overpass request failed after retries", lastErr?.message || lastErr);
  }
  return null;
}

// Helper to build a query by bbox
function buildBBoxQuery({ south, west, north, east }) {
  return `
[out:json][timeout:25];
(
  node["place"](${south},${west},${north},${east});
  way["place"](${south},${west},${north},${east});
  relation["place"](${south},${west},${north},${east});
);
out center;
`;
}

// Sports POIs (stadiums, soccer pitches)
function buildSportsBBoxQuery({ south, west, north, east }) {
  return `
[out:json][timeout:25];
(
  node["leisure"~"^(stadium|pitch)$"](${south},${west},${north},${east});
  way["leisure"~"^(stadium|pitch)$"](${south},${west},${north},${east});
  relation["leisure"~"^(stadium|pitch)$"](${south},${west},${north},${east});
  node["sport"="soccer"](${south},${west},${north},${east});
  way["sport"="soccer"](${south},${west},${north},${east});
  relation["sport"="soccer"](${south},${west},${north},${east});
);
out center;
`;
}

export async function fetchSportsPOIs({ bbox } = {}) {
  const key = bbox ? `sports:bbox:${bbox.south},${bbox.west},${bbox.north},${bbox.east}` : "sports:area:Buyo";
  if (cache.has(key)) return cache.get(key);
  const query = bbox
    ? buildSportsBBoxQuery(bbox)
    : `
[out:json][timeout:25];
area["name"="Buyo"]->.searchArea;
(
  node["leisure"~"^(stadium|pitch)$"](area.searchArea);
  way["leisure"~"^(stadium|pitch)$"](area.searchArea);
  relation["leisure"~"^(stadium|pitch)$"](area.searchArea);
  node["sport"="soccer"](area.searchArea);
  way["sport"="soccer"](area.searchArea);
  relation["sport"="soccer"](area.searchArea);
);
out center;
`;
  try {
    const data = await postOverpassWithRetries(query);
    if (!data) return [];
    const elements = Array.isArray(data?.elements) ? data.elements : [];
    const out = elements
      .map((el) => {
        const tags = el.tags || {};
        const name = tags.name || tags["name:fr"] || tags["name:en"];
        if (!name) return null;
        const lat = el.lat || el.center?.lat;
        const lon = el.lon || el.center?.lon;
        if (typeof lat !== "number" || typeof lon !== "number") return null;
        return { name, lat, lon, source: "overpass:sports" };
      })
      .filter(Boolean);
    const seen = new Set();
    const unique = [];
    for (const p of out) {
      const k = (p.name || "").trim().toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      unique.push(p);
    }
    cache.set(key, unique);
    return unique;
  } catch (err) {
    if (!(typeof navigator !== "undefined" && navigator.onLine === false)) {
      // Only warn if not clearly offline; suppress spam when offline
      console.warn("Overpass(sports) fetch failed", err?.message || err);
    }
    return [];
  }
}

// Transport POIs (bus stations/stops, public transport stops)
function buildTransportBBoxQuery({ south, west, north, east }) {
  return `
[out:json][timeout:25];
(
  node["amenity"~"^(bus_station|bus_stop)$"](${south},${west},${north},${east});
  way["amenity"~"^(bus_station|bus_stop)$"](${south},${west},${north},${east});
  relation["amenity"~"^(bus_station|bus_stop)$"](${south},${west},${north},${east});
  node["public_transport"~"^(station|stop_position|platform)$"](${south},${west},${north},${east});
  way["public_transport"~"^(station|stop_position|platform)$"](${south},${west},${north},${east});
  relation["public_transport"~"^(station|stop_position|platform)$"](${south},${west},${north},${east});
);
out center;
`;
}

export async function fetchTransportPOIs({ bbox } = {}) {
  const key = bbox ? `transport:bbox:${bbox.south},${bbox.west},${bbox.north},${bbox.east}` : "transport:area:Buyo";
  if (cache.has(key)) return cache.get(key);
  const query = bbox
    ? buildTransportBBoxQuery(bbox)
    : `
[out:json][timeout:25];
area["name"="Buyo"]->.searchArea;
(
  node["amenity"~"^(bus_station|bus_stop)$"](area.searchArea);
  way["amenity"~"^(bus_station|bus_stop)$"](area.searchArea);
  relation["amenity"~"^(bus_station|bus_stop)$"](area.searchArea);
  node["public_transport"~"^(station|stop_position|platform)$"](area.searchArea);
  way["public_transport"~"^(station|stop_position|platform)$"](area.searchArea);
  relation["public_transport"~"^(station|stop_position|platform)$"](area.searchArea);
);
out center;
`;
  try {
    const data = await postOverpassWithRetries(query);
    if (!data) return [];
    const elements = Array.isArray(data?.elements) ? data.elements : [];
    const out = elements
      .map((el) => {
        const tags = el.tags || {};
        const name = tags.name || tags["name:fr"] || tags["name:en"];
        if (!name) return null;
        const lat = el.lat || el.center?.lat;
        const lon = el.lon || el.center?.lon;
        if (typeof lat !== "number" || typeof lon !== "number") return null;
        return { name, lat, lon, source: "overpass:transport" };
      })
      .filter(Boolean);
    const seen = new Set();
    const unique = [];
    for (const p of out) {
      const k = (p.name || "").trim().toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      unique.push(p);
    }
    cache.set(key, unique);
    return unique;
  } catch (err) {
    if (!(typeof navigator !== "undefined" && navigator.onLine === false)) {
      console.warn("Overpass(transport) fetch failed", err?.message || err);
    }
    return [];
  }
}

// In-memory cache keyed by bbox string or 'area:Buyo'
const cache = new Map();

export async function fetchBuyoPlaces({ bbox } = {}) {
  const key = bbox ? `bbox:${bbox.south},${bbox.west},${bbox.north},${bbox.east}` : "area:Buyo";
  if (cache.has(key)) return cache.get(key);
  const query = bbox
    ? buildBBoxQuery(bbox)
    : `
[out:json][timeout:25];
area["name"="Buyo"]->.searchArea;
(
  node["place"](area.searchArea);
  way["place"](area.searchArea);
  relation["place"](area.searchArea);
);
out center;
`;
  try {
    const data = await postOverpassWithRetries(query);
    if (!data) return [];
    const elements = Array.isArray(data?.elements) ? data.elements : [];

    // Normalize to { name, lat, lon }
    const out = elements
      .map((el) => {
        const tags = el.tags || {};
        const name = tags.name || tags["name:fr"] || tags["name:en"];
        if (!name) return null;
        const lat = el.lat || el.center?.lat;
        const lon = el.lon || el.center?.lon;
        if (typeof lat !== "number" || typeof lon !== "number") return null;
        const placeType = tags.place || "";
        return { name, lat, lon, placeType, source: "overpass" };
      })
      .filter(Boolean);

    // De-duplicate by name, keep first occurrence
    const seen = new Set();
    const unique = [];
    for (const p of out) {
      const key = p.name.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(p);
    }
    cache.set(key, unique);
    return unique;
  } catch (err) {
    if (!(typeof navigator !== "undefined" && navigator.onLine === false)) {
      console.warn("Overpass(places) fetch failed", err?.message || err);
    }
    return [];
  }
}

// Build a query for health amenities in bbox
function buildHealthBBoxQuery({ south, west, north, east }) {
  return `
[out:json][timeout:25];
(
  node["amenity"~"^(hospital|clinic|doctors|health_centre|pharmacy)$"](${south},${west},${north},${east});
  way["amenity"~"^(hospital|clinic|doctors|health_centre|pharmacy)$"](${south},${west},${north},${east});
  relation["amenity"~"^(hospital|clinic|doctors|health_centre|pharmacy)$"](${south},${west},${north},${east});
);
out center;
`;
}

export async function fetchHealthPOIs({ bbox } = {}) {
  const key = bbox ? `health:bbox:${bbox.south},${bbox.west},${bbox.north},${bbox.east}` : "health:area:Buyo";
  if (cache.has(key)) return cache.get(key);
  const query = bbox
    ? buildHealthBBoxQuery(bbox)
    : `
[out:json][timeout:25];
area["name"="Buyo"]->.searchArea;
(
  node["amenity"~"^(hospital|clinic|doctors|health_centre|pharmacy)$"](area.searchArea);
  way["amenity"~"^(hospital|clinic|doctors|health_centre|pharmacy)$"](area.searchArea);
  relation["amenity"~"^(hospital|clinic|doctors|health_centre|pharmacy)$"](area.searchArea);
);
out center;
`;
  try {
    const data = await postOverpassWithRetries(query);
    if (!data) return [];
    const elements = Array.isArray(data?.elements) ? data.elements : [];
    const out = elements
      .map((el) => {
        const tags = el.tags || {};
        const name = tags.name || tags["name:fr"] || tags["name:en"];
        if (!name) return null;
        const lat = el.lat || el.center?.lat;
        const lon = el.lon || el.center?.lon;
        if (typeof lat !== "number" || typeof lon !== "number") return null;
        return { name, lat, lon, source: "overpass:health", amenity: tags.amenity };
      })
      .filter(Boolean);
    const seen = new Set();
    const unique = [];
    for (const p of out) {
      const k = (p.name || "").trim().toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      unique.push(p);
    }
    cache.set(key, unique);
    return unique;
  } catch (err) {
    if (!(typeof navigator !== "undefined" && navigator.onLine === false)) {
      console.warn("Overpass(health) fetch failed", err?.message || err);
    }
    return [];
  }
}
