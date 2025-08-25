"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });

  useEffect(() => {
    // Si déjà connecté en admin, rediriger
    try {
      const u = JSON.parse(localStorage.getItem('tri_user_admin') || 'null');
      if (u?.role === 'admin') router.replace('/admin');
    } catch {}
  }, [router]);

  const login = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const res = await fetch(`${base}/api/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      localStorage.setItem('tri_token_admin', data.token);
      localStorage.setItem('tri_user_admin', JSON.stringify({ id: data.id, name: data.name, role: data.role }));
      router.replace('/admin');
    } catch (e) {
      setErr(e.message || 'Erreur serveur');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-6 h-6 text-orange-600" viewBox="0 0 24 24" fill="currentColor"><path d="M5 12a7 7 0 0 1 14 0v6a2 2 0 0 1-2 2h-3a1 1 0 0 1-1-1v-3H11v3a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2v-6Z"/></svg>
          <div className="font-bold text-slate-800">Espace Admin</div>
        </div>
        <form onSubmit={login} className="space-y-3">
          <div className="text-sm text-slate-700">Connexion administrateur</div>
          {err && <div className="text-xs text-red-600">{err}</div>}
          <label className="block">
            <div className="text-xs text-slate-500 mb-1">Nom d’utilisateur</div>
            <input required value={loginForm.username} onChange={(e)=>setLoginForm(f=>({...f, username:e.target.value}))} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
          <label className="block">
            <div className="text-xs text-slate-500 mb-1">Mot de passe</div>
            <input required type="password" value={loginForm.password} onChange={(e)=>setLoginForm(f=>({...f, password:e.target.value}))} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
          <button disabled={busy} type="submit" className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white rounded-xl px-4 py-2 text-sm">{busy? 'Connexion...' : 'Se connecter'}</button>
        </form>
      </div>
    </div>
  );
}
