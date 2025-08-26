"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function PreCommandePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [recentPlaces, setRecentPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

  const timeAgo = (iso) => {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    if (!then) return '';
    const now = Date.now();
    const diff = Math.max(0, Math.floor((now - then) / 1000)); // seconds
    if (diff < 60) return `${diff}s`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} j`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} mois`;
    const years = Math.floor(months / 12);
    return `${years} an${years > 1 ? 's' : ''}`;
  };

  const km = (a, b) => {
    if (!a || !b || typeof a.lat !== 'number' || typeof a.lon !== 'number' || typeof b.lat !== 'number' || typeof b.lon !== 'number') return null;
    const R = 6371; // km
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLon = (b.lon - a.lon) * Math.PI / 180;
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;
    const sinDLat = Math.sin(dLat/2);
    const sinDLon = Math.sin(dLon/2);
    const c = 2 * Math.asin(Math.sqrt(sinDLat*sinDLat + Math.cos(lat1)*Math.cos(lat2)*sinDLon*sinDLon));
    return R * c;
  };

  useEffect(() => {
    const loadRecent = async () => {
      try {
        setLoading(true);
        setError("");
        const token = typeof window !== 'undefined' ? localStorage.getItem('tri_token_client') : null;
        if (!token) { setRecentPlaces([]); setLoading(false); return; }
        const res = await fetch(`${base}/api/orders/client/recent?limit=3`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 401) {
          try { localStorage.removeItem('tri_token_client'); localStorage.removeItem('tri_user_client'); } catch {}
          setRecentPlaces([]);
          setLoading(false);
          return;
        }
        const data = await res.json().catch(() => ({ orders: [] }));
        const items = (data.orders || []).map((o) => {
          const dist = km(o.start, o.destination);
          const mins = typeof dist === 'number' ? Math.round((dist / 20) * 60) : null; // ~20km/h
          return {
            id: o.id,
            title: o.destination?.name || 'Destination récente',
            subtitle: o.start?.name || '',
            eta: typeof mins === 'number' ? `${mins} min` : '',
            timeAgo: timeAgo(o.completedAt || o.createdAt),
            icon: 'pin',
          };
        });
        // Ensure we only show the 3 most recent items
        setRecentPlaces(items.slice(0, 3));
      } catch (e) {
        setError(e?.message || 'Erreur de chargement');
        setRecentPlaces([]);
      } finally {
        setLoading(false);
      }
    };
    loadRecent();
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/search?dest=${encodeURIComponent(q)}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-amber-100">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Logo */}
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-orange-600" fill="currentColor"><path d="M5 12a7 7 0 0 1 14 0v6a2 2 0 0 1-2 2h-3a1 1 0 0 1-1-1v-3H11v3a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2v-6Z"/></svg>
            <span className="font-bold text-slate-800">Tricycle</span>
          </div>
          <button onClick={() => router.push("/")} className="text-sm text-orange-700 hover:underline">Accueil</button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-4">
        {/* Title */}
        <h1 className="text-xl font-semibold text-slate-800 mb-3">On va où aujourd’hui ?</h1>

        {/* Destination pill */}
        <form onSubmit={onSubmit} className="mb-5">
          <div className="relative bg-slate-100 hover:bg-slate-50 transition rounded-2xl shadow-inner">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              {/* Small car icon */}
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M3 11h1l1.2-3a3 3 0 0 1 2.82-2h7.96a3 3 0 0 1 2.82 2L20 11h1a1 1 0 0 1 1 1v4a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2H7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a1 1 0 0 1 1-1Zm4.5 5A1.5 1.5 0 1 0 6 14.5 1.5 1.5 0 0 0 7.5 16Zm9 0A1.5 1.5 0 1 0 15 14.5 1.5 1.5 0 0 0 16.5 16ZM7 9l.6-1.5a1 1 0 0 1 .93-.63H15.5a1 1 0 0 1 .93.63L17 9H7Z"/></svg>
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => router.push('/commander')}
              onClick={() => router.push('/commander')}
              className="w-full pl-10 pr-12 py-3 rounded-2xl bg-transparent outline-none text-[15px] placeholder-slate-400"
              placeholder="Où allons-nous ?"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl px-3 py-2 text-sm font-semibold"
              aria-label="Rechercher"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="m21.53 20.47-3.74-3.74a8 8 0 1 0-1.06 1.06l3.74 3.74a.75.75 0 1 0 1.06-1.06ZM4.5 11a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0Z"/></svg>
            </button>
          </div>
        </form>

        {/* Quick tiles removed as requested */}

        {/* Recent destinations */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 text-sm text-slate-500">Récents</div>
          {loading ? (
            <div className="px-4 py-4 text-sm text-slate-500">Chargement...</div>
          ) : recentPlaces.length === 0 ? (
            <div className="px-4 py-4 text-sm text-slate-400">Aucune destination récente</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentPlaces.map((p) => (
                <li key={p.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/search?dest=${encodeURIComponent(p.title)}`)}>
                  <div className="shrink-0 text-slate-400">
                    {p.icon === 'pin' ? (
                      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 10a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"/></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor"><path d="M12 8a1 1 0 0 1 1 1v3.38l2.24 1.29a1 1 0 1 1-1 1.74l-2.74-1.58A1 1 0 0 1 11 13V9a1 1 0 0 1 1-1Zm0-6a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z"/></svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-medium text-slate-800 truncate">{p.title}</div>
                    <div className="text-xs text-slate-500 truncate">{p.subtitle}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-600">{p.eta}</div>
                    {p.timeAgo ? (<div className="text-[11px] text-slate-400">il y a {p.timeAgo}</div>) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Bottom safe area */}
      <div className="h-8" />
    </div>
  );
}
