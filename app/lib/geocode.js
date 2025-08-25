// app/lib/geocode.js
// Client helper calling backend proxy to avoid browser CORS issues

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

// In-memory cache to reduce duplicate requests during a session
const cache = new Map();

export async function geocodeSearch(query, { limit = 5, country = "ci", lang = "fr" } = {}) {
  const q = (query || "").trim();
  if (!q) return [];
  const key = `${q}|${limit}|${country}|${lang}`;
  if (cache.has(key)) return cache.get(key);

  const params = new URLSearchParams({ q, limit: String(limit), country, lang });

  const res = await fetch(`${API_BASE}/api/geocode/search?${params.toString()}`);
  if (!res.ok) return [];
  const data = await res.json();
  const results = (data || []).map((it) => ({
    name: it.name,
    lat: parseFloat(it.lat),
    lon: parseFloat(it.lon),
    source: it.source || "nominatim",
  }));
  cache.set(key, results);
  return results;
}
