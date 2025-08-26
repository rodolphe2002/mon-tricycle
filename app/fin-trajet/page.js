"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "../components/ToastProvider";

// Utils
const toRad = (x) => (x * Math.PI) / 180;
const haversineKm = (a, b) => {
  if (!a || !b) return 0;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

function FinDeTrajetContent() {
  const router = useRouter();
  const params = useSearchParams();
  const orderId = params.get("id");

  // Payment can still come from query for now (no payment entity yet)
  const payment = params.get("pay") || "Espèces"; // Espèces / Wallet / Carte

  // Live order values
  const [km, setKm] = useState(null);
  const [min, setMin] = useState(null);
  const [price, setPrice] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const toast = useToast();

  // Ensure we have an orderId: fallback from localStorage and update URL if needed
  useEffect(() => {
    if (orderId) return;
    try {
      const saved = localStorage.getItem("tri_last_order_id");
      if (saved) router.replace(`/fin-trajet?id=${encodeURIComponent(saved)}`);
    } catch {}
  }, [orderId, router]);

  // Fetch order and compute km/min/price
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (!orderId) return;
        const base = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
        const token = localStorage.getItem("tri_token_client");
        if (!token) { router.replace("/login"); return; }
        const res = await fetch(`${base}/api/orders/${orderId}?t=${Date.now()}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          try { localStorage.removeItem('tri_token_client'); localStorage.removeItem('tri_user_client'); } catch {}
          router.replace('/login');
          return;
        }
        if (!res.ok) throw new Error(data?.error || 'Erreur de chargement');
        if (cancelled) return;
        // Compute distance
        const start = data?.start;
        const dest = data?.destination;
        const dKm = (start && dest) ? haversineKm(start, dest) : 0;
        setKm(dKm);
        // Compute minutes: prefer actual ride duration
        const startedAt = data?.startedAt ? new Date(data.startedAt) : null;
        const completedAt = data?.completedAt ? new Date(data.completedAt) : null;
        if (startedAt && completedAt && completedAt > startedAt) {
          const ms = completedAt.getTime() - startedAt.getTime();
          setMin(Math.max(1, Math.round(ms / 60000)));
        } else {
          // Estimate from distance at ~22 km/h
          const speedKmh = 22;
          setMin(dKm ? Math.max(1, Math.round((dKm / speedKmh) * 60)) : 0);
        }
        // Price: use final or priceEstimate
        const p = typeof data?.priceEstimate === 'number' ? data.priceEstimate : Math.max(700, Math.round(300 + dKm * 180));
        setPrice(p);
      } catch (e) {
        if (!cancelled) setErr(e?.message || 'Erreur');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run().then(() => {
      // no-op
    });
    return () => { cancelled = true; };
  }, [orderId, router]);

  // Also fetch existing rating/review to prefill and lock UI if already rated
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (!orderId) return;
        const base = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
        const token = localStorage.getItem("tri_token_client");
        if (!token) return;
        const res = await fetch(`${base}/api/orders/${orderId}?t=${Date.now()}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (cancelled || !res.ok) return;
        if (typeof data?.rating === 'number' && data.rating >= 1) {
          setRating(Math.round(data.rating));
          setNotes(data?.review || "");
          setAlreadyRated(true);
        }
      } catch {}
    };
    load();
    return () => { cancelled = true; };
  }, [orderId]);

  const [rating, setRating] = useState(5);
  const [tip, setTip] = useState(0);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [alreadyRated, setAlreadyRated] = useState(false);

  // No email modal anymore; receipts are downloaded as PDF directly

  // Helper to persist finalization (tip, payment, receipt prefs)
  const finalizeOrder = async (opts = {}) => {
    if (!orderId) return;
    const base = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
    const token = localStorage.getItem("tri_token_client");
    if (!token) { router.replace('/login'); return; }
    const body = {
      tip: Number(tip) || 0,
      paymentMethod: payment,
    };
    if (opts.receiptRequested) body.receiptRequested = opts.receiptRequested;
    if (opts.receiptEmail) body.receiptEmail = opts.receiptEmail;
    await fetch(`${base}/api/orders/${orderId}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  };

  const total = useMemo(() => (Number(price) || 0) + (Number(tip) || 0), [price, tip]);

  // Helper: submit rating/review once
  const submitRatingIfNeeded = async () => {
    if (!orderId) return;
    const base = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
    const token = localStorage.getItem("tri_token_client");
    if (!token) { router.replace('/login'); return; }
    if (!alreadyRated && rating >= 1 && rating <= 5) {
      await fetch(`${base}/api/orders/${orderId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rating, review: notes }),
      });
      setAlreadyRated(true);
    }
  };

  const sendReceipt = async (type) => {
    try {
      if (type === 'pdf') {
        toast.info('Téléchargement du reçu en cours...');
        await downloadPdfReceipt();
      }
    } catch (e) {
      toast.error("Téléchargement du reçu impossible.");
    }
  };

  const downloadPdfReceipt = async () => {
    if (!orderId) return;
    const base = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
    const token = localStorage.getItem("tri_token_client");
    if (!token) { router.replace('/login'); return; }
    const url = `${base}/api/orders/${orderId}/receipt.pdf`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Réçu indisponible');
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `recu-tricycle-${orderId.slice(-6)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  };

  const goHistory = async () => {
    try { await submitRatingIfNeeded(); } catch {}
    try { await finalizeOrder(); } catch {}
    router.push("/historique");
  };
  const handleClose = async () => {
    try { await submitRatingIfNeeded(); } catch {}
    try { await finalizeOrder(); } catch {}
    router.push("/");
  };
  const finish = async () => {
    try {
      if (!orderId) { router.push('/'); return; }
      setSubmitting(true);
      const base = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
      const token = localStorage.getItem("tri_token_client");
      if (!token) { router.replace('/login'); return; }
      // Submit rating only if not already rated
      await submitRatingIfNeeded();
      // Persist tip/payment
      try { await finalizeOrder(); } catch {}
      toast.success("Merci pour votre course !");
      router.push("/");
    } catch (e) {
      toast.error("Envoi de la note impossible. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-amber-100">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-orange-600" viewBox="0 0 24 24" fill="currentColor"><path d="M5 12a7 7 0 0 1 14 0v6a2 2 0 0 1-2 2h-3a1 1 0 0 1-1-1v-3H11v3a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2v-6Z"/></svg>
            <span className="font-bold text-slate-800">Fin de trajet</span>
          </div>
          <button type="button" onClick={handleClose} className="text-sm text-orange-700 hover:underline">Accueil</button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Résumé */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="text-sm font-semibold text-slate-800 mb-3">Résumé du trajet</div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <SummaryItem label="Distance" value={km != null ? `${km.toFixed(1)} km` : '—'} />
            <SummaryItem label="Durée" value={min != null ? `${min} min` : '—'} />
            <SummaryItem label="Paiement" value={payment || '—'} />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-slate-600">Prix</span>
            <span className="font-semibold">{Number(price) ? Number(price) : 0} CFA</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-slate-600">Pourboire</span>
            <TipSelector tip={tip} setTip={setTip} />
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-slate-700 font-medium">Total</span>
            <span className="text-slate-900 font-bold">{total} CFA</span>
          </div>
        </div>

        {/* Notation conducteur */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="text-sm font-semibold text-slate-800 mb-2">Noter le conducteur</div>
          <div className="flex items-center gap-2">
            {[1,2,3,4,5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setRating(s)}
                className={`w-10 h-10 rounded-full flex items-center justify-center ${s <= rating ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'}`}
                aria-label={`${s} étoiles`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Un commentaire pour améliorer l'expérience…"
            className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-400"
            rows={3}
          />
        </div>

        {/* Reçus et historique */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="text-sm font-semibold text-slate-800 mb-2">Reçus & Historique</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <button type="button" onClick={() => sendReceipt('pdf')} className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-2">Reçu PDF</button>
            <button type="button" onClick={goHistory} className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-2">Historique</button>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={finish} className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl py-3 font-semibold">Terminer</button>
          <button type="button" onClick={() => router.push('/trajet-en-cours')} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl py-3">Retour</button>
        </div>
      </div>

      <div className="h-8" />

      {/* Email option removed */}
    </div>
  );
}

export default function FinDeTrajetPage() {
  return (
    <Suspense fallback={null}>
      <FinDeTrajetContent />
    </Suspense>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-slate-800 font-medium">{value}</div>
    </div>
  );
}

function TipSelector({ tip, setTip }) {
  const presets = [0, 100, 200, 500];
  return (
    <div className="flex items-center gap-2">
      {presets.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => setTip(v)}
          className={`px-2 py-1 rounded-lg text-sm ${tip === v ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}
        >
          {v === 0 ? 'Aucun' : `+${v}`}
        </button>
      ))}
      <input
        type="number"
        min={0}
        value={tip}
        onChange={(e) => setTip(Number(e.target.value))}
        className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-orange-400"
      />
    </div>
  );
}
