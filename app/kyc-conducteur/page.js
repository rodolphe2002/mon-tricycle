"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../components/ToastProvider";

export default function KycConducteurPage() {
  const router = useRouter();
  const toast = useToast();

  const [form, setForm] = useState({
    name: "",
    password: "",
    phone: "",
    district: "",
    plate: "",
  });

  const [files, setFiles] = useState({
    vehiclePhoto: null,
    idPhoto: null,
    selfie: null,
  });

  const [preview, setPreview] = useState({
    vehiclePhoto: "",
    idPhoto: "",
    selfie: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onPick = (key) => (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFiles((s) => ({ ...s, [key]: f }));
    const url = URL.createObjectURL(f);
    setPreview((p) => ({ ...p, [key]: url }));
  };

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const isValid = () => {
    return (
      form.name.trim().length >= 2 &&
      form.password.trim().length >= 6 &&
      /[0-9+\s-]{7,}/.test(form.phone) &&
      form.district.trim().length >= 2 &&
      form.plate.trim().length >= 4 &&
      files.vehiclePhoto && files.idPhoto && files.selfie
    );
  };

  const submit = async () => {
    if (!isValid()) {
      toast.error("Veuillez compléter tous les champs requis correctement.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('password', form.password);
      fd.append('phone', form.phone.trim());
      fd.append('district', form.district.trim());
      fd.append('plate', form.plate.trim());
      if (files.vehiclePhoto) fd.append('vehiclePhoto', files.vehiclePhoto);
      if (files.idPhoto) fd.append('idPhoto', files.idPhoto);
      if (files.selfie) fd.append('selfie', files.selfie);

      const res = await fetch(`${base}/api/kyc/driver`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Envoi KYC échoué');

      // Marquer ce device comme 'conducteur connu' pour rediriger l'accueil vers /login
      try { localStorage.setItem('tri_known_driver', '1'); } catch {}
      // Ne pas stocker de token ici: accès uniquement après validation admin
      toast.success('KYC envoyé. Nous vous notifierons après validation.');
      router.push('/login-conducteur');
    } catch (e) {
      setError(e?.message || 'Erreur lors de l\'envoi');
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
            <span className="font-bold text-slate-800">Inscription / KYC conducteur</span>
          </div>
          <button type="button" onClick={() => router.push("/")} className="text-sm text-orange-700 hover:underline">Accueil</button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3">{error}</div>
        )}

        {/* Infos personnelles */}
        <Section title="Informations personnelles">
          <div className="space-y-3">
            <Field label="Nom et prénoms">
              <input value={form.name} onChange={update('name')} className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-orange-400" placeholder="Ex: Koffi Yao" />
            </Field>
            <Field label="Mot de passe">
              <input type="password" value={form.password} onChange={update('password')} className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-orange-400" placeholder="******" />
            </Field>
            <Field label="Téléphone">
              <input value={form.phone} onChange={update('phone')} className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-orange-400" placeholder="Ex: +225 01 02 03 04 05" />
            </Field>
            <Field label="Quartier de résidence">
              <input value={form.district} onChange={update('district')} className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-orange-400" placeholder="Ex: Cocody" />
            </Field>
          </div>
        </Section>

        {/* Véhicule */}
        <Section title="Véhicule">
          <div className="space-y-3">
            <Field label="N° d’immatriculation">
              <input value={form.plate} onChange={update('plate')} className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-orange-400" placeholder="Ex: AB-274-TRI" />
            </Field>
            <Field label="Photo du véhicule">
              <Uploader preview={preview.vehiclePhoto} accept="image/*" onChange={onPick('vehiclePhoto')} />
            </Field>
            <Field label="Photo pièce d’identité">
              <Uploader preview={preview.idPhoto} accept="image/*" onChange={onPick('idPhoto')} />
            </Field>
            <Field label="Selfie (contrôle visage)">
              <Uploader preview={preview.selfie} accept="image/*" onChange={onPick('selfie')} />
            </Field>
          </div>
        </Section>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={submit} disabled={submitting} className="bg-orange-600 disabled:opacity-60 hover:bg-orange-700 text-white rounded-xl py-3 font-semibold">{submitting ? 'Envoi…' : 'Envoyer'}</button>
          <button type="button" onClick={() => router.push('/login')} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl py-3">Connexion</button>
        </div>
        <div className="text-xs text-slate-500">En envoyant, vous acceptez la vérification KYC et le traitement de vos données conformément à notre politique.</div>
      </div>

      <div className="h-8" />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="text-sm font-semibold text-slate-800 mb-3">{title}</div>
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      {children}
    </label>
  );
}

function Uploader({ preview, accept, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <label className="relative w-24 h-24 rounded-xl bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center cursor-pointer overflow-hidden">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="preview" className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs text-slate-500">Choisir
            <svg className="w-4 h-4 inline ml-1" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5v8m0 0l-3-3m3 3 3-3M5 19h14"/></svg>
          </span>
        )}
        <input type="file" accept={accept} onChange={onChange} className="absolute inset-0 opacity-0 cursor-pointer" />
      </label>
      <div className="text-xs text-slate-500">Formats: JPG/PNG. Max ~5MB. Assurez-vous que la photo est nette.</div>
    </div>
  );
}
