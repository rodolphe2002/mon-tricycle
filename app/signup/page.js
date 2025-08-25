"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../components/ToastProvider";

export default function SignupPage() {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    countryCode: "+225",
    password: "",
    neighborhood: "",
    accept: false,
  });
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");

  // If already authenticated as client, skip signup and go to pre-commande
  useEffect(() => {
    try {
      const tClient = localStorage.getItem('tri_token_client');
      const uRaw = localStorage.getItem('tri_user_client');
      const u = uRaw ? JSON.parse(uRaw) : null;
      if (tClient && u?.role === 'client') {
        router.replace('/pre-commande');
      }
    } catch {}
  }, [router]);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.accept) { toast.error("Veuillez accepter les conditions."); return; }
    try {
      setLoading(true);
      setError("");
      const base = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
      const payload = {
        name: form.fullName.trim(),
        email: form.email.trim() || undefined,
        phone: `${form.countryCode} ${form.phone}`.trim(),
        district: form.neighborhood.trim() || undefined,
        password: form.password,
      };
      const res = await fetch(`${base}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Inscription échouée");

      if (data.token) {
        if (data.role === 'driver') {
          localStorage.setItem("tri_token_driver", data.token);
          localStorage.setItem("tri_user_driver", JSON.stringify({ id: data.id, name: data.name, phone: data.phone, role: data.role }));
          router.push('/login-conducteur');
        } else {
          localStorage.setItem("tri_token_client", data.token);
          localStorage.setItem("tri_user_client", JSON.stringify({ id: data.id, name: data.name, phone: data.phone, role: data.role }));
          router.push('/pre-commande');
        }
      } else {
        router.push('/');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-orange-500 to-amber-400 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white/90 backdrop-blur rounded-2xl shadow-xl p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">Créer un compte</h1>
        <p className="text-slate-600 mb-6">Rejoignez Tricycle en 1 minute.</p>
        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-2">{error}</div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1">Nom complet</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                {/* User icon */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5Zm0 2c-4.418 0-8 2.239-8 5v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1c0-2.761-3.582-5-8-5Z"/></svg>
              </span>
              <input
                name="fullName"
                value={form.fullName}
                onChange={onChange}
                className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Ex: Awa Diop"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1">Email</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                {/* Mail icon */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 2v.01L12 13 4 6.01V6h16ZM4 18V8.236l7.386 5.916a1 1 0 0 0 1.228 0L20 8.236V18H4Z"/></svg>
              </span>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={onChange}
                className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="vous@example.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1">Téléphone</label>
            <div className="flex gap-2">
              <div className="w-28">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {/* Globe/flag icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2c1.657 0 3 3.134 3 6s-1.343 6-3 6-3-3.134-3-6 1.343-6 3-6Zm0 16a8 8 0 0 1-6.32-3h3.062C9.4 19.158 10.62 20 12 20Zm6.32-3A8 8 0 0 1 12 20c1.38 0 2.6-.842 3.258-3h3.062ZM5.94 7h3.063C9.4 4.842 10.62 4 12 4a8 8 0 0 1 6.32 3H15.26C14.6 9.158 13.38 10 12 10 10.62 10 9.4 9.158 8.742 7H5.94Z"/></svg>
                  </span>
                  <select
                    name="countryCode"
                    value={form.countryCode}
                    onChange={onChange}
                    className="w-full appearance-none rounded-xl border border-slate-200 pl-10 pr-6 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    <option value={"+225"}>+225 (CI)</option>
                    <option value={"+221"}>+221 (SN)</option>
                    <option value={"+237"}>+237 (CM)</option>
                    <option value={"+233"}>+233 (GH)</option>
                    <option value={"+234"}>+234 (NG)</option>
                  </select>
                </div>
              </div>
              <div className="flex-1">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {/* Phone icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M6.62 10.79a15.053 15.053 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.1.37 2.29.57 3.58.57a1 1 0 0 1 1 1V20a2 2 0 0 1-2 2C10.84 22 2 13.16 2 2a2 2 0 0 1 2-2h3.49a1 1 0 0 1 1 1c0 1.29.2 2.48.57 3.58a1 1 0 0 1-.25 1.01l-2.2 2.2Z"/></svg>
                  </span>
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={onChange}
                    className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-orange-400"
                    placeholder="77 123 45 67"
                    required
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1">Format: {form.countryCode} 77 123 45 67</p>
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

          <div>
            <label className="block text-sm text-slate-600 mb-1">Quartier de résidence</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                {/* Home icon */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12.707 2.293a1 1 0 0 0-1.414 0l-9 9A1 1 0 0 0 3 13h1v8a1 1 0 0 0 1 1h6v-6h2v6h6a1 1 0 0 0 1-1v-8h1a1 1 0 0 0 .707-1.707l-9-9Z"/></svg>
              </span>
              <input
                name="neighborhood"
                value={form.neighborhood}
                onChange={onChange}
                className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Ex: Cocody, Médina, Yoff..."
                required
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="accept" checked={form.accept} onChange={onChange} />
            J’accepte les Conditions d’utilisation et la Politique de confidentialité
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-[999px] py-3 font-semibold transition disabled:opacity-60"
          >
            {loading ? "Création..." : "Créer un compte"}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          Déjà un compte ?
          <button
            onClick={() => router.push("/login")}
            className="ml-1 text-orange-700 hover:underline"
          >
            Se connecter
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
