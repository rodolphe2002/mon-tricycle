"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const toRad = (x) => (x * Math.PI) / 180;
const haversineKm = (a, b) => {
  if (!a || !b) return 0;
  const R = 6371;
  const dLat = toRad((Number(b.lat) || 0) - (Number(a.lat) || 0));
  const dLon = toRad((Number(b.lon) || 0) - (Number(a.lon) || 0));
  const lat1 = toRad(Number(a.lat) || 0);
  const lat2 = toRad(Number(b.lat) || 0);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

function DetailsTrajetContent() {
  const router = useRouter();
  const params = useSearchParams();
  const orderId = params.get("id");

  const [order, setOrder] = useState(null); // {start, destination, driver, client, status}
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Ensure we have an orderId: fallback from localStorage and update URL if needed
  useEffect(() => {
    if (orderId) return;
    try {
      const saved = localStorage.getItem("tri_last_order_id");
      if (saved) router.replace(`/details-trajet?id=${encodeURIComponent(saved)}`);
    } catch {}
  }, [orderId, router]);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
    const fetchOrder = async () => {
      if (!orderId) { setLoading(false); return; }
      try {
        const token = localStorage.getItem("tri_token_client");
        if (!token) { router.replace("/login"); return; }
        const res = await fetch(`${base}/api/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          try { localStorage.removeItem("tri_token_client"); localStorage.removeItem("tri_user_client"); } catch {}
          router.replace("/login");
          return;
        }
        if (!res.ok) throw new Error(data?.error || "Chargement impossible");
        setOrder(data);
      } catch (e) {
        setError(e?.message || "Erreur");
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId, router]);

  const pickup = order?.start || null;
  const destination = order?.destination || null;
  const driver = order?.driver || null;
  const client = order?.client || null;

  const tripKm = useMemo(() => (pickup && destination ? haversineKm(pickup, destination) : 0), [pickup?.lat, pickup?.lon, destination?.lat, destination?.lon]);
  const tripPrice = useMemo(() => order?.priceEstimate ?? (tripKm ? Math.max(700, Math.round(300 + tripKm * 180)) : "—"), [order?.priceEstimate, tripKm]);

  const callDriver = () => (driver?.phone ? (window.location.href = `tel:${driver.phone}`) : null);
  const smsDriver = () => (driver?.phone ? (window.location.href = `sms:${driver.phone}`) : null);
  const callClient = () => (client?.phone ? (window.location.href = `tel:${client.phone}`) : null);
  const smsClient = () => (client?.phone ? (window.location.href = `sms:${client.phone}`) : null);

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-amber-100">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-orange-600" viewBox="0 0 24 24" fill="currentColor"><path d="M5 12a7 7 0 0 1 14 0v6a2 2 0 0 1-2 2h-3a1 1 0 0 1-1-1v-3H11v3a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2v-6Z"/></svg>
            <span className="font-bold text-slate-800">Détails du trajet</span>
          </div>
          <button type="button" onClick={() => router.back()} className="text-sm text-orange-700 hover:underline">Retour</button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {loading && (
          <div className="text-sm text-slate-500">Chargement…</div>
        )}
        {!!error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{error}</div>
        )}

        {/* Conducteur */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="text-xs font-semibold text-slate-500 mb-2">Conducteur</div>
          <div className="flex items-center gap-3">
            <img src={`https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(driver?.name || "driver")}`} alt={driver?.name || ""} className="w-14 h-14 rounded-xl object-cover bg-slate-100" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-800 truncate">{driver?.name || "—"}</div>
              <div className="text-xs text-slate-500">{driver?.plate ? `Plaque ${driver.plate}` : "Conducteur Tricycle"}</div>
              <div className="text-xs text-amber-600">★ {typeof driver?.rating === "number" ? driver.rating.toFixed(1) : "—"}</div>
            </div>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={callDriver} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg px-3 py-1 text-sm">Appeler</button>
              <button type="button" onClick={smsDriver} className="bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg px-3 py-1 text-sm">Message</button>
            </div>
          </div>
        </div>

        {/* Client */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="text-xs font-semibold text-slate-500 mb-2">Client</div>
          <div className="flex items-center gap-3">
            <img src={`https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(client?.name || "client")}`} alt={client?.name || ""} className="w-12 h-12 rounded-xl object-cover bg-slate-100" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-800 truncate">{client?.name || "—"}</div>
              <div className="text-xs text-slate-500">{client?.phone || "—"}</div>
            </div>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={callClient} className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg px-3 py-1 text-sm">Appeler</button>
              <button type="button" onClick={smsClient} className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg px-3 py-1 text-sm">Message</button>
            </div>
          </div>
        </div>

        {/* Trajet */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="text-xs font-semibold text-slate-500 mb-2">Trajet</div>
          <div className="space-y-2 text-sm text-slate-700">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 w-4 h-4 rounded-full bg-emerald-500 inline-block" />
              <div>
                <div className="text-slate-500 text-xs">Départ</div>
                <div className="font-medium text-slate-800">{pickup?.label || `${pickup?.lat ?? "—"}, ${pickup?.lon ?? "—"}`}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 w-4 h-4 rounded-full bg-orange-500 inline-block" />
              <div>
                <div className="text-slate-500 text-xs">Arrivée</div>
                <div className="font-medium text-slate-800">{destination?.label || `${destination?.lat ?? "—"}, ${destination?.lon ?? "—"}`}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-slate-50 rounded-xl p-2 text-center">
                <div className="text-xs text-slate-500">Distance</div>
                <div className="font-semibold text-slate-900">{tripKm ? `${tripKm.toFixed(1)} km` : "—"}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-2 text-center">
                <div className="text-xs text-slate-500">Estimation</div>
                <div className="font-semibold text-slate-900">{tripPrice !== "—" ? `~${tripPrice} CFA` : "—"}</div>
              </div>
            </div>
            <div className="pt-2 text-xs text-slate-500">
              Statut: <span className="text-slate-800 font-medium">{order?.status || "—"}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => router.push(orderId ? `/trajet-en-cours?id=${encodeURIComponent(orderId)}` : "/trajet-en-cours")} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl py-3 text-sm">Suivi en temps réel</button>
          <button type="button" onClick={() => router.push(orderId ? `/commande-acceptee?id=${encodeURIComponent(orderId)}` : "/commande-acceptee")} className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-3 text-sm">Vue carte</button>
        </div>
      </div>

      <div className="h-8" />
    </div>
  );
}

export default function DetailsTrajetPage() {
  return (
    <Suspense fallback={null}>
      <DetailsTrajetContent />
    </Suspense>
  );
}
