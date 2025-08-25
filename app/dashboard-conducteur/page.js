"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../components/ToastProvider";

export default function DashboardConducteurPage() {
  const router = useRouter();
  const toast = useToast();

  // Disponibilité
  const [online, setOnline] = useState(false);

  // Statistiques jour/mois (simulation)
  const [stats, setStats] = useState({
    dayTrips: 0,
    monthTrips: 0,
    dayRevenue: 0,
    monthRevenue: 0,
    acceptRate: 0, // %
  });

  // File des demandes (depuis l'API)
  const [queue, setQueue] = useState([]); // {id, start, destination, passengers, bags, bagOffer, bagDescription, priceEstimate}
  const pollAvailableRef = useRef(null);
  const pollStatsRef = useRef(null);
  const [error, setError] = useState("");
  const [geoError, setGeoError] = useState("");
  const [geo, setGeo] = useState(null); // {lat, lon, accuracy}
  const [accepted, setAccepted] = useState(null); // détails de commande acceptée + client
  const [acceptedCancelled, setAcceptedCancelled] = useState(false);
  const cancelTimerRef = useRef(null);
  // Liste des commandes refusées par ce conducteur (persistée localement)
  const [refusedIds, setRefusedIds] = useState(() => {
    try {
      const raw = localStorage.getItem('tri_refused_order_ids');
      const arr = raw ? JSON.parse(raw) : [];
      return new Set((arr || []).map(String));
    } catch {
      return new Set();
    }
  });
  const [actionError, setActionError] = useState("");
  const [acting, setActing] = useState(false);
  const heartbeatRef = useRef(null);
  const geoWatchRef = useRef(null);
  const sseRef = useRef(null);

  // Vérifier que l'utilisateur est conducteur
  useEffect(() => {
    const u = (() => { try { return JSON.parse(localStorage.getItem('tri_user_driver')) } catch { return null } })();
    if (!u || u.role !== 'driver') {
      router.push('/login-conducteur');
    }
  }, [router]);

  const handleLogout = () => {
    try {
      localStorage.removeItem('tri_token_driver');
      localStorage.removeItem('tri_user_driver');
      localStorage.removeItem('tri_last_driver_order_id');
    } catch {}
    router.replace('/login-conducteur');
  };

  const cancelAsDriver = async () => {
    if (!accepted?.id) return;
    setActing(true);
    setActionError("");
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
      const token = localStorage.getItem('tri_token_driver');
      const res = await fetch(`${base}/api/orders/${accepted.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: 'Driver cancellation from UI' }),
      });
      if (res.status === 401) { try { localStorage.removeItem('tri_token_driver'); localStorage.removeItem('tri_user_driver'); } catch {} router.replace('/login-conducteur'); return; }
      // ignore server error body: UX should still clear local UI to avoid ghost state
    } catch (e) {
      // Best-effort cancellation; still clear local state
    } finally {
      setActing(false);
      setAccepted(null);
      setAcceptedCancelled(false);
      try { localStorage.removeItem('tri_last_driver_order_id'); } catch {}
      try { toast.warning('Course annulée.'); } catch {}
    }
  };

  // Demander la géolocalisation dès l'arrivée sur le dashboard
  useEffect(() => {
    const askGeo = async () => {
      try {
        setGeoError("");
        if (!('geolocation' in navigator)) {
          setGeoError("La géolocalisation n'est pas supportée par ce navigateur.");
          return;
        }
        const requestPosition = () => new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          });
        });
        // Tenter une lecture directe; le navigateur affichera la permission si nécessaire
        const pos = await requestPosition();
        const coords = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setGeo(coords);
        try { localStorage.setItem('tri_last_location', JSON.stringify(coords)); } catch {}
      } catch (e) {
        const msg = e?.message || 'Impossible de récupérer la position.';
        setGeoError(msg);
      }
    };
    askGeo();
  }, []);

  // Charger l'état en ligne depuis l'API au montage
  useEffect(() => {
    (async () => {
      try {
        const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
        const token = localStorage.getItem('tri_token_driver');
        if (!token) return;
        const res = await fetch(`${base}/api/drivers/me/status`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 401) {
          try { localStorage.removeItem('tri_token_driver'); localStorage.removeItem('tri_user_driver'); } catch {}
          router.replace('/login-conducteur');
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        setOnline(!!data.online);
      } catch {}
    })();
  }, []);

  // Restaurer une commande acceptée à partir du stockage local (au remontage de l'app)
  useEffect(() => {
    (async () => {
      try {
        const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
        const token = localStorage.getItem('tri_token_driver');
        const savedId = localStorage.getItem('tri_last_driver_order_id');
        if (!token || !savedId) return;
        const r = await fetch(`${base}/api/orders/${encodeURIComponent(savedId)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (r.status === 401) { try { localStorage.removeItem('tri_token_driver'); localStorage.removeItem('tri_user_driver'); } catch {} router.replace('/login-conducteur'); return; }
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d) return;
        const status = d.status;
        // Si la commande est encore active côté backend, injecter dans l'UI
        if (["assigned", "in_progress"].includes(status)) {
          setAccepted({
            id: d._id || d.id,
            start: d.start,
            destination: d.destination,
            passengers: d.passengers,
            bags: d.bags,
            bagOffer: d.bagOffer ?? 0,
            bagDescription: d.bagDescription || "",
            priceEstimate: d.priceEstimate,
            status: d.status,
            client: d.client || {},
            acceptedAt: d.acceptedAt,
            startedAt: d.startedAt,
            completedAt: d.completedAt,
          });
          setAcceptedCancelled(false);
        } else if (["completed", "cancelled", "canceled"].includes(status)) {
          try { localStorage.removeItem('tri_last_driver_order_id'); } catch {}
        }
      } catch {}
    })();
  }, []);

  // Polling des commandes disponibles quand en ligne
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('tri_token_driver');
        if (!token) return;
        const res = await fetch(`${base}/api/orders/driver/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          try { localStorage.removeItem('tri_token_driver'); localStorage.removeItem('tri_user_driver'); } catch {}
          router.replace('/login-conducteur');
          return;
        }
        if (!res.ok) return; // silencieux
        const data = await res.json();
        setStats((s) => ({
          ...s,
          dayTrips: data.dayTrips || 0,
          dayRevenue: data.dayRevenue || 0,
          monthTrips: data.monthTrips || 0,
          monthRevenue: data.monthRevenue || 0,
          acceptRate: data.acceptRate ?? s.acceptRate,
        }));
      } catch {}
    };
    const fetchAvailable = async () => {
      try {
        setError("");
        const token = localStorage.getItem('tri_token_driver');
        if (!token) return;
        const res = await fetch(`${base}/api/orders/available`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          try { localStorage.removeItem('tri_token_driver'); localStorage.removeItem('tri_user_driver'); } catch {}
          router.replace('/login-conducteur');
          return;
        }
        if (!res.ok) {
          const msg = (await res.json().catch(() => ({})))?.error || 'Erreur de chargement';
          throw new Error(msg);
        }
        const data = await res.json();
        const itemsRaw = (data.orders || []).map(o => ({
          id: o._id || o.id,
          start: o.start,
          destination: o.destination,
          passengers: o.passengers,
          bags: o.bags,
          bagOffer: o.bagOffer ?? 0,
          bagDescription: o.bagDescription || "",
          priceEstimate: o.priceEstimate,
          createdAt: o.createdAt,
        }));
        // Filtrer les commandes déjà refusées localement (lecture fraîche)
        let refusedSet = refusedIds;
        try {
          const raw = localStorage.getItem('tri_refused_order_ids');
          const arr = raw ? JSON.parse(raw) : [];
          refusedSet = new Set((arr || []).map(String));
        } catch {}
        setQueue(itemsRaw.filter(it => !refusedSet.has(String(it.id))));
      } catch (e) {
        setError(e?.message || 'Erreur réseau');
      }
    };

    if (online) {
      fetchAvailable();
      fetchStats();
      pollAvailableRef.current = setInterval(fetchAvailable, 5000);
      pollStatsRef.current = setInterval(fetchStats, 10000);
    } else {
      if (pollAvailableRef.current) clearInterval(pollAvailableRef.current);
      if (pollStatsRef.current) clearInterval(pollStatsRef.current);
      pollAvailableRef.current = null;
      pollStatsRef.current = null;
      setQueue([]);
    }
    return () => {
      if (pollAvailableRef.current) clearInterval(pollAvailableRef.current);
      if (pollStatsRef.current) clearInterval(pollStatsRef.current);
      pollAvailableRef.current = null;
      pollStatsRef.current = null;
    };
  }, [online]);

  // Sync presence + heartbeat when online toggles
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
    const token = localStorage.getItem('tri_token_driver');
    const updatePresence = async (value) => {
      try {
        if (!token) return;
        const r = await fetch(`${base}/api/drivers/me/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ online: !!value }),
        });
        if (r.status === 401) {
          try { localStorage.removeItem('tri_token_driver'); localStorage.removeItem('tri_user_driver'); } catch {}
          router.replace('/login-conducteur');
          return;
        }
      } catch {}
    };

    updatePresence(online);

    if (online) {
      // Open SSE stream to receive real-time events
      try {
        if (!sseRef.current && token) {
          const url = `${base}/api/orders/stream?token=${encodeURIComponent(token)}`;
          const es = new EventSource(url);
          sseRef.current = es;
          es.addEventListener('order_assigned', (ev) => {
            try {
              const data = JSON.parse(ev.data || '{}');
              if (data?.orderId) {
                setQueue((q) => q.filter((r) => String(r.id) !== String(data.orderId)));
              }
            } catch {}
          });
          es.addEventListener('order_cancelled', (ev) => {
            try {
              const data = JSON.parse(ev.data || '{}');
              const oid = String(data?.orderId || '');
              if (!oid) return;
              // Retirer de la file si présent
              setQueue((q) => q.filter((r) => String(r.id) !== oid));
              // Si c'est la commande acceptée actuelle
              setAccepted((a) => {
                if (!a || String(a.id) !== oid) return a;
                // Marquer comme annulée visuellement et désactiver actions
                const updated = { ...a, status: 'cancelled' };
                setAcceptedCancelled(true);
                try { toast.error('Commande annulée par le client.'); } catch {}
                if (cancelTimerRef.current) { try { clearTimeout(cancelTimerRef.current); } catch {} }
                cancelTimerRef.current = setTimeout(() => {
                  setAccepted(null);
                  setAcceptedCancelled(false);
                  try { localStorage.removeItem('tri_last_driver_order_id'); } catch {}
                }, 3000);
                return updated;
              });
            } catch {}
          });
          es.onerror = () => {
            // Let polling cover transient errors; close and retry on next online toggle
          };
        }
      } catch {}

      // Start heartbeat every 60s
      heartbeatRef.current = setInterval(async () => {
        try {
          if (!token) return;
          const r = await fetch(`${base}/api/drivers/me/heartbeat`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (r.status === 401) {
            try { localStorage.removeItem('tri_token_driver'); localStorage.removeItem('tri_user_driver'); } catch {}
            router.replace('/login-conducteur');
            return;
          }
        } catch {}
      }, 60000);
      // Mark offline on unload
      const beforeUnload = () => {
        try {
          const payload = JSON.stringify({ online: false });
          navigator.sendBeacon?.(`${base}/api/drivers/me/status`, new Blob([payload], { type: 'application/json' }));
        } catch {}
      };
      window.addEventListener('beforeunload', beforeUnload);
      // Start geolocation watch and push to backend
      if ('geolocation' in navigator && !geoWatchRef.current) {
        geoWatchRef.current = navigator.geolocation.watchPosition(
          async (pos) => {
            try {
              const payload = {
                lat: pos.coords.latitude,
                lon: pos.coords.longitude,
                acc: pos.coords.accuracy,
              };
              setGeo({ lat: payload.lat, lon: payload.lon, accuracy: payload.acc });
              try { localStorage.setItem('tri_last_location', JSON.stringify({ lat: payload.lat, lon: payload.lon, accuracy: payload.acc })); } catch {}
              if (token) {
                const r = await fetch(`${base}/api/drivers/me/location`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify(payload),
                }).catch(() => {});
                if (r && r.status === 401) {
                  try { localStorage.removeItem('tri_token_driver'); localStorage.removeItem('tri_user_driver'); } catch {}
                  router.replace('/login-conducteur');
                  return;
                }
              }
            } catch {}
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
        );
      }
      return () => {
        window.removeEventListener('beforeunload', beforeUnload);
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
        if (sseRef.current) { try { sseRef.current.close(); } catch {} sseRef.current = null; }
        if (cancelTimerRef.current) { try { clearTimeout(cancelTimerRef.current); } catch {} cancelTimerRef.current = null; }
        if (geoWatchRef.current && 'geolocation' in navigator) {
          try { navigator.geolocation.clearWatch(geoWatchRef.current); } catch {}
        }
        geoWatchRef.current = null;
      };
    } else {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
      if (sseRef.current) { try { sseRef.current.close(); } catch {} sseRef.current = null; }
      if (cancelTimerRef.current) { try { clearTimeout(cancelTimerRef.current); } catch {} cancelTimerRef.current = null; }
      if (geoWatchRef.current && 'geolocation' in navigator) {
        try { navigator.geolocation.clearWatch(geoWatchRef.current); } catch {}
      }
      geoWatchRef.current = null;
    }
  }, [online]);

  const accept = async (id) => {
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
      const token = localStorage.getItem('tri_token_driver');
      if (!token) {
        toast.error('Session expirée. Veuillez vous reconnecter.');
        router.replace('/login-conducteur');
        return;
      }
      const res = await fetch(`${base}/api/orders/${id}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { try { localStorage.removeItem('tri_token_driver'); localStorage.removeItem('tri_user_driver'); } catch {} router.replace('/login-conducteur'); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Acceptation échouée');
      setAccepted(data);
      try { localStorage.setItem('tri_last_driver_order_id', String(id)); } catch {}
      setQueue((q) => q.filter((r) => r.id !== id));
      // refresh stats after acceptance
      try {
        const resStats = await fetch(`${base}/api/orders/driver/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resStats.status === 401) { try { localStorage.removeItem('tri_token_driver'); localStorage.removeItem('tri_user_driver'); } catch {} router.replace('/login-conducteur'); return; }
        if (resStats.ok) {
          const ds = await resStats.json();
          setStats((s) => ({
            ...s,
            dayTrips: ds.dayTrips || 0,
            dayRevenue: ds.dayRevenue || 0,
            monthTrips: ds.monthTrips || 0,
            monthRevenue: ds.monthRevenue || 0,
            acceptRate: ds.acceptRate ?? s.acceptRate,
          }));
        }
      } catch {}
    } catch (e) {
      toast.error(e?.message || "Erreur lors de l'acceptation");
    }
  };

  const startRide = async () => {
    if (!accepted?.id) return;
    setActing(true);
    setActionError("");
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
      const token = localStorage.getItem('tri_token_driver');
      const res = await fetch(`${base}/api/orders/${accepted.id}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { try { localStorage.removeItem('tri_token_driver'); localStorage.removeItem('tri_user_driver'); } catch {} router.replace('/login-conducteur'); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Impossible de démarrer la course');
      setAccepted((a) => ({ ...a, status: data.status, startedAt: data.startedAt }));
    } catch (e) {
      setActionError(e?.message || 'Erreur');
    } finally {
      setActing(false);
    }
  };

  const completeRide = async () => {
    if (!accepted?.id) return;
    setActing(true);
    setActionError("");
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
      const token = localStorage.getItem('tri_token_driver');
      const res = await fetch(`${base}/api/orders/${accepted.id}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { try { localStorage.removeItem('tri_token_driver'); localStorage.removeItem('tri_user_driver'); } catch {} router.replace('/login-conducteur'); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Impossible de terminer la course');
      setAccepted((a) => ({ ...a, status: data.status, completedAt: data.completedAt }));
      try { localStorage.removeItem('tri_last_driver_order_id'); } catch {}
      // refresh stats after completion
      try {
        const resStats = await fetch(`${base}/api/orders/driver/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resStats.status === 401) { try { localStorage.removeItem('tri_token_driver'); localStorage.removeItem('tri_user_driver'); } catch {} router.replace('/login-conducteur'); return; }
        if (resStats.ok) {
          const ds = await resStats.json();
          setStats((s) => ({
            ...s,
            dayTrips: ds.dayTrips || 0,
            dayRevenue: ds.dayRevenue || 0,
            monthTrips: ds.monthTrips || 0,
            monthRevenue: ds.monthRevenue || 0,
            acceptRate: ds.acceptRate ?? s.acceptRate,
          }));
        }
      } catch {}
    } catch (e) {
      setActionError(e?.message || 'Erreur');
    } finally {
      setActing(false);
    }
  };

  const refuse = (id) => {
    const sid = String(id);
    setQueue((q) => q.filter((r) => String(r.id) !== sid));
    setStats((s) => ({ ...s, acceptRate: Math.max(50, Math.round(s.acceptRate - 1)) }));
    setRefusedIds((prev) => {
      const next = new Set(prev);
      next.add(sid);
      try { localStorage.setItem('tri_refused_order_ids', JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  };

  const dayAvg = useMemo(() => (stats.dayTrips ? Math.round(stats.dayRevenue / stats.dayTrips) : 0), [stats.dayTrips, stats.dayRevenue]);

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-amber-100">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-orange-600" viewBox="0 0 24 24" fill="currentColor"><path d="M5 12a7 7 0 0 1 14 0v6a2 2 0 0 1-2 2h-3a1 1 0 0 1-1-1v-3H11v3a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2v-6Z"/></svg>
            <span className="font-bold text-slate-800">Dashboard conducteur</span>
          </div>
          <button type="button" onClick={handleLogout} className="text-sm text-orange-700 hover:underline">Se déconnecter</button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Alerte géolocalisation */}
        {geoError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-sm">
            <div className="font-medium mb-1">Localisation requise</div>
            <div className="mb-2">{geoError} Autorisez l'accès à la localisation pour recevoir des demandes à proximité.</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-1 rounded-md bg-amber-600 text-white text-xs"
                onClick={() => {
                  // Re-tenter
                  setGeoError("");
                  if ('geolocation' in navigator) {
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy };
                        setGeo(coords);
                        try { localStorage.setItem('tri_last_location', JSON.stringify(coords)); } catch {}
                      },
                      (err) => setGeoError(err?.message || 'Refusé'),
                      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                    );
                  }
                }}
              >Activer la localisation</button>
              <a
                href="https://support.google.com/chrome/answer/142065?hl=fr"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-amber-700 underline"
              >Comment autoriser la localisation</a>
            </div>
          </div>
        )}
        {/* Disponibilité */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`inline-flex h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            <span className="text-sm text-slate-700">{online ? 'En ligne' : 'Hors ligne'}</span>
          </div>
          <button
            type="button"
            onClick={() => setOnline((v) => !v)}
            className={`px-3 py-1 rounded-lg text-sm font-medium ${online ? 'bg-slate-100 text-slate-700' : 'bg-emerald-50 text-emerald-700'}`}
          >
            {online ? 'Se déconnecter' : 'Se mettre en ligne'}
          </button>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <div className="text-xs text-slate-500">Trajets aujourd'hui</div>
            <div className="text-xl font-semibold text-slate-800">{stats.dayTrips}</div>
            <div className="text-xs text-slate-500">Revenu: {stats.dayRevenue} CFA • {dayAvg} CFA / course</div>
          </Card>
          <Card>
            <div className="text-xs text-slate-500">Trajets ce mois</div>
            <div className="text-xl font-semibold text-slate-800">{stats.monthTrips}</div>
            <div className="text-xs text-slate-500">Revenu: {stats.monthRevenue} CFA</div>
          </Card>
          <Card>
            <div className="text-xs text-slate-500">Taux d’acceptation</div>
            <div className="text-xl font-semibold text-slate-800">{stats.acceptRate}%</div>
            <div className="mt-2 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div className="bg-orange-500 h-2" style={{ width: `${stats.acceptRate}%` }} />
            </div>
          </Card>
          <Card>
            <div className="text-xs text-slate-500">État</div>
            <div className="text-xl font-semibold text-slate-800">{online ? 'Disponible' : 'Indisponible'}</div>
            <div className="text-xs text-slate-500">Activez-vous pour recevoir des demandes</div>
          </Card>
        </div>

        {/* File des demandes */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-slate-800">Demandes en temps réel</div>
            <span className="text-xs text-slate-500">{online ? 'Actif' : 'Inactif'}</span>
          </div>
          {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
          {queue.length === 0 ? (
            <div className="text-sm text-slate-500 py-6 text-center">{online ? 'En attente de demandes…' : 'Mettez-vous en ligne pour recevoir des demandes.'}</div>
          ) : (
            <ul className="space-y-2">
              {queue.map((r) => (
                <li key={r.id} className="border border-slate-200 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{r?.start?.name || 'Départ'} → {r?.destination?.name || 'Arrivée'}</div>
                      <div className="text-xs text-slate-500">{r?.start?.lat},{r?.start?.lon} → {r?.destination?.lat},{r?.destination?.lon}</div>
                      <div className="mt-1 text-xs text-slate-600">
                        <span className="mr-2">Pax: <span className="font-medium">{r?.passengers ?? '—'}</span></span>
                        <span className="mr-2">Bagages: <span className="font-medium">{r?.bags ?? 0}</span></span>
                        {typeof r?.bagOffer === 'number' && r?.bagOffer > 0 && (
                          <span className="mr-2">Offre bagages: <span className="font-medium">{r.bagOffer} CFA</span></span>
                        )}
                      </div>
                      {r?.bagDescription ? (
                        <div className="text-xs text-slate-500">Description: {r.bagDescription}</div>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-slate-900">{r.priceEstimate ? `${r.priceEstimate} CFA` : '—'}</div>
                      <div className="text-xs text-slate-500">créée: {new Date(r.createdAt).toLocaleTimeString()}</div>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <button type="button" onClick={() => accept(r.id)} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg py-2">Accepter</button>
                    <button type="button" onClick={() => refuse(r.id)} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg py-2">Refuser</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Détails de la commande acceptée */}
        {accepted && (
          <section className={`${acceptedCancelled || accepted?.status === 'cancelled' ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'} rounded-2xl border p-3`}
          >
            <div className={`text-sm font-semibold ${acceptedCancelled || accepted?.status === 'cancelled' ? 'text-red-800' : 'text-emerald-800'}`}>Commande acceptée</div>
            <div className="mt-1 text-sm text-emerald-900">
              <div><span className="font-medium">Client:</span> {accepted?.client?.name || '—'} • {accepted?.client?.phone || '—'}</div>
              <div><span className="font-medium">Trajet:</span> {(accepted?.start?.name || 'Départ')} → {(accepted?.destination?.name || 'Arrivée')}</div>
              <div className="mt-1">
                <span className="font-medium">Passagers:</span> {accepted?.passengers ?? '—'}
                <span className="ml-3 font-medium">Bagages:</span> {accepted?.bags ?? 0}
              </div>
              <div className="text-xs text-emerald-700">
                Offre bagages: {typeof accepted?.bagOffer === 'number' ? `${accepted.bagOffer} CFA` : '—'}
              </div>
              {accepted?.bagDescription ? (
                <div className="text-xs text-emerald-700">Description: {accepted.bagDescription}</div>
              ) : null}
              <div className="text-xs text-emerald-700">Acceptée: {accepted?.acceptedAt ? new Date(accepted.acceptedAt).toLocaleTimeString() : ''}</div>
              <div className="text-xs text-emerald-700">Début: {accepted?.startedAt ? new Date(accepted.startedAt).toLocaleTimeString() : '—'}</div>
              <div className="text-xs text-emerald-700">Fin: {accepted?.completedAt ? new Date(accepted.completedAt).toLocaleTimeString() : '—'}</div>
              <div className="mt-1 text-sm font-semibold text-emerald-900">Total estimé: {accepted?.priceEstimate ? `${accepted.priceEstimate} CFA` : '—'}</div>
              <div className={`mt-1 text-xs ${acceptedCancelled || accepted?.status === 'cancelled' ? 'text-red-700' : ''}`}>
                <span className="font-medium">Statut:</span> {accepted?.status}
                {(acceptedCancelled || accepted?.status === 'cancelled') && (
                  <span className="ml-2">(sera retirée dans 3s)</span>
                )}
              </div>
            </div>
            {actionError && <div className="text-xs text-red-700 mt-1">{actionError}</div>}
            <div className="mt-2 flex flex-wrap gap-2">
              {accepted?.status === 'assigned' && (
                <button type="button" disabled={acting || acceptedCancelled || accepted?.status === 'cancelled'} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm rounded-lg px-3 py-2" onClick={startRide}>Démarrer la course</button>
              )}
              {accepted?.status === 'in_progress' && (
                <button type="button" disabled={acting || acceptedCancelled || accepted?.status === 'cancelled'} className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm rounded-lg px-3 py-2" onClick={completeRide}>Terminer la course</button>
              )}
              {accepted?.status === 'completed' ? (
                <button
                  type="button"
                  className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg px-3 py-2"
                  onClick={() => { setAccepted(null); setAcceptedCancelled(false); }}
                >Fermer</button>
              ) : (
                <button type="button" disabled={acting || acceptedCancelled || accepted?.status === 'cancelled'} className={`bg-white border ${acceptedCancelled || accepted?.status === 'cancelled' ? 'border-red-300 text-red-700' : 'border-emerald-300 text-emerald-700'} disabled:opacity-50 text-sm rounded-lg px-3 py-2`} onClick={cancelAsDriver}>Annuler</button>
              )}
            </div>
          </section>
        )}
      </div>

      <div className="h-8" />
    </div>
  );
}

function Card({ children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
      {children}
    </div>
  );
}
