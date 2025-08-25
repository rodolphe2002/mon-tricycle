"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../components/ToastProvider";

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");

  // If already authenticated as client, go directly to pre-commande
  useEffect(() => {
    try {
      const token = localStorage.getItem('tri_token_client');
      const raw = localStorage.getItem('tri_user_client');
      const u = raw ? JSON.parse(raw) : null;
      if (token && u?.role === 'client') {
        router.replace('/pre-commande');
      }
    } catch {}
  }, [router]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");
      const base = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
      const res = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: form.identifier.trim(), password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Connexion échouée");

      // Interdire la connexion des conducteurs via le formulaire client
      if (data.role === 'driver') {
        throw new Error("Ce compte est un conducteur. Veuillez utiliser la connexion conducteur.");
      }

      if (data.token) {
        localStorage.setItem("tri_token_client", data.token);
        localStorage.setItem("tri_user_client", JSON.stringify({ id: data.id, name: data.name, phone: data.phone, role: data.role }));
      }
      router.push('/pre-commande');
    } catch (err) {
      setError(err?.message || "Connexion échouée");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-orange-500 to-amber-400 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white/90 backdrop-blur rounded-2xl shadow-xl p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">Se connecter</h1>
        <p className="text-slate-600 mb-6">Ravi de vous revoir.</p>
        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-2">{error}</div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1">Email ou téléphone</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                {/* Mail/phone icon */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 2v.01L12 13 4 6.01V6h16ZM4 18V8.236l7.386 5.916a1 1 0 0 0 1.228 0L20 8.236V18H4Z"/></svg>
              </span>
              <input
                name="identifier"
                value={form.identifier}
                onChange={onChange}
                className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="vous@example.com ou +221 77 123 45 67"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1">Mot de passe</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                {/* Lock icon */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M17 9h-1V7a4 4 0 1 0-8 0v2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2ZM9 7a3 3 0 1 1 6 0v2H9V7Zm3 6a2 2 0 0 1 1 3.732V18a1 1 0 1 1-2 0v-1.268A2 2 0 0 1 12 13Z"/></svg>
              </span>
              <input
                type={showPwd ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={onChange}
                className="w-full rounded-xl border border-slate-200 pl-10 pr-12 py-3 outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="••••••••"
                minLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {/* Eye icon */}
                {showPwd ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M2.81 2.81a1 1 0 0 1 1.41 0l16.97 16.97a1 1 0 0 1-1.41 1.41l-2.5-2.5A11.36 11.36 0 0 1 12 21C6 21 1.73 16.64.46 12.88a1.24 1.24 0 0 1 0-.76c.51-1.65 1.66-3.61 3.43-5.23L2.81 4.22a1 1 0 0 1 0-1.41ZM12 7a5 5 0 0 1 5 5c0 .51-.08 1-.23 1.47l-2.02-2.02A2.99 2.99 0 0 0 12 9a3 3 0 0 0-3 3c0 .44.09.87.26 1.25l-1.46-1.46C7.43 10.08 9.5 7 12 7Z"/><path d="M19.54 7.12C21.27 8.71 22.4 10.62 22.94 12.12c.12.34.12.71 0 1.04C21.67 16.93 17.4 21 12 21a11.36 11.36 0 0 1-4.64-.96l2.11-2.11c.79.29 1.65.45 2.53.45 3.31 0 6-2.69 6-6 0-.88-.17-1.74-.47-2.52l2.01-2.01Z"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 5c-6 0-10.27 4.07-11.54 7.24a1.24 1.24 0 0 0 0 .76C1.73 16.93 6 21 12 21s10.27-4.07 11.54-7.24c.12-.33.12-.7 0-1.04C22.27 9.07 18 5 12 5Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              className="text-sm text-orange-700 hover:underline"
              onClick={() => toast.info('Fonctionnalité à venir: réinitialisation du mot de passe')}
            >
              Mot de passe oublié ?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-[999px] py-3 font-semibold transition disabled:opacity-60"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          Nouveau sur Tricycle ?
          <button
            onClick={() => router.push("/signup")}
            className="ml-1 text-orange-700 hover:underline"
          >
            Créer un compte
          </button>
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Vous êtes conducteur ?
          <button
            onClick={() => router.push("/kyc-conducteur")}
            className="ml-1 text-orange-700 hover:underline"
          >
            Devenir conducteur (KYC)
          </button>
        </p>
      </div>
    </div>
  );
}
