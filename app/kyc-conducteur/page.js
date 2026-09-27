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
    email: "",
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
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [passwordCriteria, setPasswordCriteria] = useState({
    hasLowercase: false,
    hasUppercase: false,
    hasMinLength: false,
    hasNumber: false,
    hasSpecialChar: false,
  });
  const [showPwd, setShowPwd] = useState(false);

  const onPick = (key) => (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFiles((s) => ({ ...s, [key]: f }));
    const url = URL.createObjectURL(f);
    setPreview((p) => ({ ...p, [key]: url }));
  };

  const update = (k) => (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
    
    // Validation en temps réel pour le nom complet
    if (name === "name") {
      const words = value.trim().split(/\s+/);
      if (value.trim() && words.length < 2) {
        setNameError("Ce n'est pas un format correct de nom complet");
      } else if (value.trim()) {
        // Vérifier chaque mot
        let hasInvalidWord = false;
        let hasShortWord = false;
        
        for (const word of words) {
          // Vérifier que le mot contient uniquement des lettres
          if (!/^[a-zA-ZÀ-ÿ]+$/.test(word)) {
            hasInvalidWord = true;
            break;
          }
          // Vérifier que le mot a au moins 2 caractères
          if (word.length < 2) {
            hasShortWord = true;
          }
        }
        
        if (hasInvalidWord) {
          setNameError("Ce n'est pas un format correct de nom complet");
        } else if (hasShortWord) {
          setNameError("Ce n'est pas un format correct de nom complet");
        } else {
          setNameError("");
        }
      } else {
        setNameError("");
      }
    }
    
    // Validation en temps réel pour l'email
    if (name === "email" && value.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      if (!emailRegex.test(value.trim())) {
        setEmailError("votre mail n'est pas correcte");
      } else {
        setEmailError("");
      }
    } else if (name === "email" && !value.trim()) {
      setEmailError("");
    }
    
    // Validation et formatage pour le téléphone
    if (name === "phone") {
      // Supprimer tous les caractères non numériques
      const cleanValue = value.replace(/\D/g, '');
      
      // Mettre à jour le formulaire avec la valeur nettoyée
      setForm((f) => ({ ...f, phone: cleanValue }));
      
      // Formater automatiquement si 10 chiffres
      if (cleanValue.length === 10) {
        const formatted = `${cleanValue.slice(0, 2)} ${cleanValue.slice(2, 4)} ${cleanValue.slice(4, 7)} ${cleanValue.slice(7, 10)}`;
        setForm((f) => ({ ...f, phone: formatted }));
        setPhoneError("");
      } else if (cleanValue.length > 0 && cleanValue.length !== 10) {
        setPhoneError("votre numéro est incorrect");
      } else {
        setPhoneError("");
      }
    }
    
    // Validation du mot de passe
    if (name === "password") {
      const criteria = {
        hasLowercase: /[a-z]/.test(value),
        hasUppercase: /[A-Z]/.test(value),
        hasMinLength: value.length >= 8,
        hasNumber: /\d/.test(value),
        hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value),
      };
      setPasswordCriteria(criteria);
    }
  };

  const isValid = () => {
    // Validation du nom complet
    const nameWords = form.name.trim().split(/\s+/);
    if (nameWords.length < 2) return false;
    
    for (const word of nameWords) {
      if (!/^[a-zA-ZÀ-ÿ]+$/.test(word) || word.length < 2) return false;
    }
    
    // Validation de l'email (si fourni)
    if (form.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      if (!emailRegex.test(form.email.trim())) return false;
    }
    
    // Validation du téléphone
    const cleanPhone = form.phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) return false;
    
    // Validation du mot de passe (3 critères cruciaux)
    const hasMinLength = form.password.length >= 8;
    const hasLowercase = /[a-z]/.test(form.password);
    const hasUppercase = /[A-Z]/.test(form.password);
    
    if (!hasMinLength || !hasLowercase || !hasUppercase) return false;
    
    return (
      form.district.trim().length >= 2 &&
      form.plate.trim().length >= 4 &&
      files.vehiclePhoto && files.idPhoto && files.selfie
    );
  };

  const submit = async () => {
    // Validation du nom complet
    const nameWords = form.name.trim().split(/\s+/);
    if (nameWords.length < 2) {
      toast.error("Ce n'est pas un format correct de nom complet");
      return;
    }
    
    for (const word of nameWords) {
      if (!/^[a-zA-ZÀ-ÿ]+$/.test(word)) {
        toast.error("Ce n'est pas un format correct de nom complet");
        return;
      }
      if (word.length < 2) {
        toast.error("Ce n'est pas un format correct de nom complet");
        return;
      }
    }
    
    // Validation de l'email (si fourni)
    if (form.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      if (!emailRegex.test(form.email.trim())) {
        toast.error("votre mail n'est pas correcte");
        return;
      }
    }
    
    // Validation du téléphone
    const cleanPhone = form.phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      toast.error("votre numéro est incorrect");
      return;
    }
    
    // Validation du mot de passe (3 critères cruciaux)
    const hasMinLength = form.password.length >= 8;
    const hasLowercase = /[a-z]/.test(form.password);
    const hasUppercase = /[A-Z]/.test(form.password);
    
    if (!hasMinLength || !hasLowercase || !hasUppercase) {
      toast.error("votre mot de passe est incorrect");
      return;
    }
    
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
      if (form.email.trim()) fd.append('email', form.email.trim());
      if (files.vehiclePhoto) fd.append('vehiclePhoto', files.vehiclePhoto);
      if (files.idPhoto) fd.append('idPhoto', files.idPhoto);
      if (files.selfie) fd.append('selfie', files.selfie);

      const res = await fetch(`${base}/api/kyc/driver`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMessage = typeof data === 'string' ? data : data?.error || 'Envoi KYC échoué';
        throw new Error(errorMessage);
      }

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
            <span className="font-black italic text-2xl text-orange-600">TRICYCLE</span>
          </div>
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
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5Zm0 2c-4.418 0-8 2.239-8 5v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1c0-2.761-3.582-5-8-5Z"/></svg>
                </span>
                <input 
                  name="name"
                  value={form.name} 
                  onChange={update('name')} 
                  className={`w-full rounded-xl border pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-orange-400 ${nameError ? 'border-red-400' : 'border-slate-200'}`}
                  placeholder="Ex: Koffi Yao" 
                />
              </div>
              {nameError && (
                <p className="mt-1 text-sm text-red-600">{nameError}</p>
              )}
            </Field>
            
            <Field label="Email">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 2v.01L12 13 4 6.01V6h16ZM4 18V8.236l7.386 5.916a1 1 0 0 0 1.228 0L20 8.236V18H4Z"/></svg>
                </span>
                <input 
                  name="email"
                  type="email"
                  value={form.email} 
                  onChange={update('email')} 
                  className={`w-full rounded-xl border pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-orange-400 ${emailError ? 'border-red-400' : 'border-slate-200'}`}
                  placeholder="vous@example.com" 
                />
              </div>
              {emailError && (
                <p className="mt-1 text-sm text-red-600">{emailError}</p>
              )}
            </Field>
            
            <Field label="Téléphone">
              <div className="flex gap-2">
                <div className="w-28">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2c1.657 0 3 3.134 3 6s-1.343 6-3 6-3-3.134-3-6 1.343-6 3-6Zm0 16a8 8 0 0 1-6.32-3h3.062C9.4 19.158 10.62 20 12 20Zm6.32-3A8 8 0 0 1 12 20c1.38 0 2.6-.842 3.258-3h3.062ZM5.94 7h3.063C9.4 4.842 10.62 4 12 4a8 8 0 0 1 6.32 3H15.26C14.6 9.158 13.38 10 12 10 10.62 10 9.4 9.158 8.742 7H5.94Z"/></svg>
                    </span>
                    <div className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-3 text-sm bg-slate-50 flex items-center justify-center font-medium text-slate-700">
                      +225
                    </div>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M6.62 10.79a15.053 15.053 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.1.37 2.29.57 3.58.57a1 1 0 0 1 1 1V20a2 2 0 0 1-2 2C10.84 22 2 13.16 2 2a2 2 0 0 1 2-2h3.49a1 1 0 0 1 1 1c0 1.29.2 2.48.57 3.58a1 1 0 0 1-.25 1.01l-2.2 2.2Z"/></svg>
                    </span>
                    <input 
                      name="phone"
                      type="tel"
                      value={form.phone} 
                      onChange={update('phone')} 
                      className={`w-full rounded-xl border pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-orange-400 ${phoneError ? 'border-red-400' : 'border-slate-200'}`}
                      placeholder="77 123 45 67" 
                    />
                  </div>
                  {phoneError && (
                    <p className="mt-1 text-sm text-red-600">{phoneError}</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">Format: +225 77 123 45 67</p>
            </Field>
            
            <Field label="Mot de passe">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M17 9h-1V7a4 4 0 1 0-8 0v2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2ZM9 7a3 3 0 1 1 6 0v2H9V7Zm3 6a2 2 0 0 1 1 3.732V18a1 1 0 1 1-2 0v-1.268A2 2 0 0 1 12 13Z"/></svg>
                </span>
                <input 
                  name="password"
                  type={showPwd ? "text" : "password"}
                  value={form.password} 
                  onChange={update('password')} 
                  className="w-full rounded-xl border border-slate-200 pl-10 pr-12 py-3 outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="••••••••"
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
              
              {/* Indicateurs de validation du mot de passe */}
              <div className="flex items-center gap-2 mt-2">
                <div className="flex gap-1">
                  {(() => {
                    const criteriaCount = Object.values(passwordCriteria).filter(Boolean).length;
                    const dots = [];
                    
                    for (let i = 0; i < 5; i++) {
                      let colorClass = 'bg-gray-300';
                      
                      if (i < criteriaCount) {
                        if (criteriaCount <= 2) {
                          colorClass = 'bg-red-500';
                        } else if (criteriaCount === 3) {
                          colorClass = 'bg-orange-500';
                        } else if (criteriaCount === 4) {
                          colorClass = 'bg-yellow-500';
                        } else if (criteriaCount === 5) {
                          colorClass = 'bg-green-500';
                        }
                      }
                      
                      dots.push(
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-full ${colorClass}`}
                          title={`Pointillé ${i + 1}`}
                        />
                      );
                    }
                    
                    return dots;
                  })()}
                </div>
                
                {/* Indicateur de force du mot de passe */}
                {form.password && (
                  <span className={`text-xs ${
                    Object.values(passwordCriteria).filter(Boolean).length <= 2 
                      ? 'text-red-500' 
                      : Object.values(passwordCriteria).filter(Boolean).length <= 4
                      ? 'text-orange-500'
                      : 'text-green-500'
                  }`}>
                    {Object.values(passwordCriteria).filter(Boolean).length <= 2 
                      ? 'mot de passe trop faible' 
                      : Object.values(passwordCriteria).filter(Boolean).length <= 4
                      ? 'mot de passe correcte mais à améliorer'
                      : 'mot de passe fort'
                    }
                  </span>
                )}
              </div>
            </Field>
            
            <Field label="Quartier de résidence">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12.707 2.293a1 1 0 0 0-1.414 0l-9 9A1 1 0 0 0 3 13h1v8a1 1 0 0 0 1 1h6v-6h2v6h6a1 1 0 0 0 1-1v-8h1a1 1 0 0 0 .707-1.707l-9-9Z"/></svg>
                </span>
                <input 
                  name="district"
                  value={form.district} 
                  onChange={update('district')} 
                  className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-orange-400" 
                  placeholder="Ex: Cocody" 
                />
              </div>
            </Field>
          </div>
        </Section>

        {/* Véhicule */}
        <Section title="Véhicule">
          <div className="space-y-3">
            <Field label="N° d’immatriculation">
              <input name="plate" value={form.plate} onChange={update('plate')} className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-orange-400" placeholder="Ex: AB-274-TRI" />
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
