"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function RechercheConducteurPage() {
  const router = useRouter();
  const ATTEMPT_SECONDS = 15; // durée d'une tentative avant nouvel essai

  const [attempt, setAttempt] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState(ATTEMPT_SECONDS);
  const [searching, setSearching] = useState(true);

  useEffect(() => {
    if (!searching) return;
    if (secondsLeft <= 0) {
      // nouvelle tentative automatique
      setAttempt((a) => a + 1);
      setSecondsLeft(ATTEMPT_SECONDS);
      return;
    }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft, searching, ATTEMPT_SECONDS]);

  const progress = useMemo(
    () =>
      Math.max(
        0,
        Math.min(
          100,
          Math.round(((ATTEMPT_SECONDS - secondsLeft) / ATTEMPT_SECONDS) * 100)
        )
      ),
    [secondsLeft, ATTEMPT_SECONDS]
  );

  const cancel = () => {
    setSearching(false);
    router.push("/commander");
  };

  const retryNow = () => {
    setAttempt((a) => a + 1);
    setSecondsLeft(ATTEMPT_SECONDS);
    setSearching(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-orange-500 to-amber-400 flex flex-col items-center p-6">
      {/* Top bar */}
      <div className="w-full max-w-md">
        <div className="mt-2 bg-white/90 backdrop-blur rounded-2xl shadow p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-orange-600" viewBox="0 0 24 24" fill="currentColor"><path d="M5 12a7 7 0 0 1 14 0v6a2 2 0 0 1-2 2h-3a1 1 0 0 1-1-1v-3H11v3a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2v-6Z"/></svg>
            <span className="font-semibold text-slate-800">Recherche de conducteur</span>
          </div>
          <button type="button" onClick={() => router.push("/")} className="text-sm text-orange-700 hover:underline">Accueil</button>
        </div>
      </div>

      <main className="w-full max-w-md flex-1 flex flex-col items-center justify-center">
        {/* Card */}
        <div className="w-full bg-white/90 backdrop-blur rounded-2xl shadow-xl p-6 text-center">
          <div className="flex items-center justify-center mb-4">
            <Spinner progress={progress} />
          </div>
          <h1 className="text-lg font-semibold text-slate-800">Nous cherchons un tricycle…</h1>
          <p className="text-slate-600 mt-1">Tentative #{attempt} • Nouveau scan dans {secondsLeft}s</p>

          <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
            <button type="button" onClick={retryNow} className="col-span-1 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-xl py-2">Relancer</button>
            <button type="button" onClick={() => router.push("/pre-commande")} className="col-span-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-2">Modifier</button>
            <button type="button" onClick={cancel} className="col-span-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl py-2">Annuler</button>
          </div>

          <div className="mt-6 text-xs text-slate-500">
            Astuce: gardez l’app ouverte, nous re-essayons automatiquement.
          </div>
        </div>
      </main>

      <div className="h-10" />
    </div>
  );
}

function Spinner({ progress = 0 }) {
  const size = 120;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (progress / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fdba74" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
      </defs>
      <circle cx={size/2} cy={size/2} r={r} stroke="#fde68a" strokeWidth={stroke} fill="none" />
      <circle
        cx={size/2}
        cy={size/2}
        r={r}
        stroke="url(#grad)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        fill="none"
        transform={`rotate(-90 ${size/2} ${size/2})`}
      />
      <g transform={`translate(${size/2}, ${size/2})`}>
        <svg viewBox="0 0 24 24" width="36" height="36" fill="#f97316" x={-18} y={-18}>
          <path d="M4 17a3 3 0 0 0 3 3h1a3 3 0 0 0 3-3v-1h2v1a3 3 0 0 0 3 3h1a3 3 0 0 0 3-3v-4l-2-5a3 3 0 0 0-2.82-2H8.82A3 3 0 0 0 6 8l-2 5v4Z"/>
        </svg>
      </g>
    </svg>
  );
}
