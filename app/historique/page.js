"use client";

import { useRouter } from "next/navigation";

export default function HistoriquePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-amber-100">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-orange-600" viewBox="0 0 24 24" fill="currentColor"><path d="M5 12a7 7 0 0 1 14 0v6a2 2 0 0 1-2 2h-3a1 1 0 0 1-1-1v-3H11v3a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2v-6Z"/></svg>
            <span className="font-bold text-slate-800">Historique</span>
          </div>
          <button type="button" onClick={() => router.push('/')} className="text-sm text-orange-700 hover:underline">Accueil</button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="text-sm text-slate-600">Votre historique des trajets apparaîtra ici.</div>
          <div className="text-xs text-slate-500 mt-1">Fonctionnalité en cours d'intégration.</div>
        </div>
        <div>
          <button type="button" onClick={() => router.push('/')} className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl py-3 px-4 font-semibold">Retour à l'accueil</button>
        </div>
      </div>

      <div className="h-8" />
    </div>
  );
}
