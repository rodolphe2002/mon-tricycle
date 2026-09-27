// app/lib/routing.js
// Client helper calling the backend routing proxy (OSRM) to get a real road itinerary

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

// In-memory cache to avoid re-requesting identical routes during a session
const cache = new Map();

const round4 = (n) => Math.round(Number(n) * 10000) / 10000;

const haversineKm = (a, b) => {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

/**
 * Fetch a road-following route between two points.
 * @param {{lat:number, lon:number}} from
 * @param {{lat:number, lon:number}} to
 * @returns {Promise<{coordinates: [number,number][], distanceKm:number, durationMin:number, fallback:boolean}>}
 *   On any failure, returns a straight line between the two points with fallback=true.
 */
export async function fetchRoute(from, to) {
  const fallbackResult = () => ({
    coordinates: [
      [from.lat, from.lon],
      [to.lat, to.lon],
    ],
    distanceKm: Math.round(haversineKm(from, to) * 100) / 100,
    durationMin: Math.max(1, Math.round((haversineKm(from, to) / 22) * 60)),
    fallback: true,
  });

  if (!from || !to || !Number.isFinite(from.lat) || !Number.isFinite(from.lon) || !Number.isFinite(to.lat) || !Number.isFinite(to.lon)) {
    return null;
  }

  const key = `${round4(from.lon)},${round4(from.lat)}>${round4(to.lon)},${round4(to.lat)}`;
  if (cache.has(key)) return cache.get(key);

  try {
    const params = new URLSearchParams({
      from: `${from.lon},${from.lat}`,
      to: `${to.lon},${to.lat}`,
    });
    const res = await fetch(`${API_BASE}/api/routing/route?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data?.coordinates) || data.coordinates.length < 2) {
      throw new Error('Route invalide');
    }
    const out = {
      coordinates: data.coordinates,
      distanceKm: Number(data.distanceKm) || haversineKm(from, to),
      durationMin: Number(data.durationMin) || Math.max(1, Math.round((haversineKm(from, to) / 22) * 60)),
      fallback: false,
    };
    cache.set(key, out);
    return out;
  } catch {
    const fb = fallbackResult();
    // Cache the fallback briefly via a short-lived entry so we don't spam retries
    cache.set(key, fb);
    setTimeout(() => { if (cache.get(key) === fb) cache.delete(key); }, 30000);
    return fb;
  }
}
