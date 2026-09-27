"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { usePersistentState } from "../lib/persist";
import TrajetSearchModal from "../components/TrajetSearchModal";

export default function PreCommandePage() {
  const router = useRouter();
  const [recentPlaces, setRecentPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

  // Trip search modal + persisted selection (shared with /commander)
  const [modalOpen, setModalOpen] = useState(false);
  const [startText, setStartText] = usePersistentState("tri_cmd_start_text", "");
  const [destText, setDestText] = usePersistentState("tri_cmd_dest_text", "");
  const [startPoint, setStartPoint] = usePersistentState("tri_cmd_start_point", null);
  const [destPoint, setDestPoint] = usePersistentState("tri_cmd_dest_point", null);

  const applyTrip = (patch) => {
    if ("startText" in patch) setStartText(patch.startText);
    if ("startPoint" in patch) setStartPoint(patch.startPoint);
    if ("destText" in patch) setDestText(patch.destText);
    if ("destPoint" in patch) setDestPoint(patch.destPoint);
  };

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
            start: o.start || null,
            destination: o.destination || null,
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

  const pickRecent = (p) => {
    if (p.start?.lat && p.destination?.lat) {
      applyTrip({
        startText: p.start.name || '',
        startPoint: { name: p.start.name, lat: p.start.lat, lon: p.start.lon },
        destText: p.destination.name || '',
        destPoint: { name: p.destination.name, lat: p.destination.lat, lon: p.destination.lon },
      });
      router.push('/commander');
    } else {
      applyTrip({ destText: p.title || '', destPoint: null });
      setModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-amber-100">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black italic text-orange-600 font-inter tracking-tight">TRICYCLE</span>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-4">
        {/* Title */}
        <h1 className="text-xl font-semibold text-slate-800 mb-3">On va où aujourd’hui ?</h1>

        {/* Destination pill — opens the full-screen trip search modal */}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="w-full mb-4 relative bg-gray-50 hover:bg-gray-100 transition rounded-2xl shadow-inner text-left"
        >
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <img src="/tricycle.png" alt="Tricycle" className="w-9 h-9" />
          </span>
          <span className={`block w-full pl-14 pr-14 py-4 rounded-2xl text-[15px] font-semibold truncate ${destText ? 'text-slate-800' : 'text-gray-400'}`}>
            {destText || "Où allons-nous ?"}
          </span>
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-orange-600 text-white rounded-xl px-4 py-2 text-sm font-semibold">
            <img src="/recherhce.svg" alt="" className="w-5 h-5" />
          </span>
        </button>

        {/* Quick tiles removed as requested */}

        {/* Recent destinations */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 text-lg font-bold text-slate-800 tracking-wide">Récents</div>
          {loading ? (
            <div className="px-4 py-4 text-base font-semibold text-slate-600 tracking-wide">Chargement...</div>
          ) : recentPlaces.length === 0 ? (
            <div className="px-4 py-4 text-base font-bold text-slate-500 tracking-wide">Aucune destination récente</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentPlaces.map((p) => (
                <li key={p.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 cursor-pointer" onClick={() => pickRecent(p)}>
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

      {/* Full-screen trip search modal (slides up from bottom) */}
      <TrajetSearchModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onDone={() => router.push('/commander')}
        trip={{ startText, startPoint, destText, destPoint }}
        onChange={applyTrip}
      />
    </div>
  );
}
