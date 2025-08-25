"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DriverLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tri_user_driver");
      const u = raw ? JSON.parse(raw) : null;
      if (u?.role === "driver") {
        router.replace("/dashboard-conducteur");
      }
    } catch {}
  }, [router]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
      const res = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: form.identifier.trim(), password: form.password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Connexion échouée");

      if (data?.role !== "driver") {
        throw new Error("Ce compte n'est pas un conducteur");
      }

      if (data?.token) {
        localStorage.setItem("tri_token_driver", data.token);
        localStorage.setItem(
          "tri_user_driver",
          JSON.stringify({ id: data.id, name: data.name, phone: data.phone, role: data.role })
        );
      }

      router.replace("/dashboard-conducteur");
    } catch (err) {
      setError(err?.message || "Connexion échouée");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-orange-500 to-amber-400 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white/90 backdrop-blur rounded-2xl shadow-xl p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">Connexion Conducteur</h1>
        <p className="text-slate-600 mb-6">Accédez à votre tableau de bord conducteur.</p>
        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-2">{error}</div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1">Téléphone ou Email</label>
            <div className="relative">
              <input
                name="identifier"
                value={form.identifier}
                onChange={onChange}
                className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Ex: +225 77 00 00 00 ou vous@example.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1">Mot de passe</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={onChange}
                className="w-full rounded-xl border border-slate-200 pl-3 pr-12 py-3 outline-none focus:ring-2 focus:ring-orange-400"
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
                {showPwd ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M2.81 2.81a1 1 0 0 1 1.41 0l16.97 16.97a1 1 0 0 1-1.41 1.41l-2.5-2.5A11.36 11.36 0 0 1 12 21C6 21 1.73 16.64.46 12.88a1.24 1.24 0 0 1 0-.76c.51-1.65 1.66-3.61 3.43-5.23L2.81 4.22a1 1 0 0 1 0-1.41ZM12 7a5 5 0 0 1 5 5c0 .51-.08 1-.23 1.47l-2.02-2.02A2.99 2.99 0 0 0 12 9a3 3 0 0 0-3 3c0 .44.09.87.26 1.25l-1.46-1.46C7.43 10.08 9.5 7 12 7Z"/><path d="M19.54 7.12C21.27 8.71 22.4 10.62 22.94 12.12c.12.34.12.71 0 1.04C21.67 16.93 17.4 21 12 21a11.36 11.36 0 0 1-4.64-.96l2.11-2.11c.79.29 1.65.45 2.53.45 3.31 0 6-2.69 6-6 0-.88-.17-1.74-.47-2.52l2.01-2.01Z"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 5c-6 0-10.27 4.07-11.54 7.24a1.24 1.24 0 0 0 0 .76C1.73 16.93 6 21 12 21s10.27-4.07 11.54-7.24c.12-.33.12-.7 0-1.04C22.27 9.07 18 5 12 5Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>
                )}
              </button>
            </div>
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
          Pas encore conducteur ?
          <button onClick={() => router.push("/kyc-conducteur")} className="ml-1 text-orange-700 hover:underline">Devenir conducteur (KYC)</button>
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Vous êtes un client ?
          <button onClick={() => router.push("/login")} className="ml-1 text-orange-700 hover:underline">Connexion client</button>
        </p>
      </div>
    </div>
  );
}
