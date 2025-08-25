"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const ToastCtx = createContext({ show: () => {}, success: () => {}, error: () => {}, info: () => {} });

let idSeq = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const remove = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const tm = timersRef.current.get(id);
    if (tm) { clearTimeout(tm); timersRef.current.delete(id); }
  }, []);

  const show = useCallback((opts) => {
    const id = idSeq++;
    const toast = {
      id,
      type: opts?.type || "info", // info | success | error | warning
      title: opts?.title || null,
      message: opts?.message || "",
      duration: Math.max(1500, Math.min(8000, Number(opts?.duration) || 3000)),
    };
    setToasts((prev) => [toast, ...prev].slice(0, 5));
    const tm = setTimeout(() => remove(id), toast.duration);
    timersRef.current.set(id, tm);
    return id;
  }, [remove]);

  const api = useMemo(() => ({
    show,
    success: (message, title = "Succès", duration) => show({ type: "success", message, title, duration }),
    error: (message, title = "Erreur", duration) => show({ type: "error", message, title, duration }),
    info: (message, title = "Information", duration) => show({ type: "info", message, title, duration }),
    warning: (message, title = "Attention", duration) => show({ type: "warning", message, title, duration }),
  }), [show]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      {/* Toast container */}
      <div className="pointer-events-none fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-3 w-[92%] max-w-md">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              "pointer-events-auto shadow-lg rounded-xl border px-4 py-3 flex items-start gap-3",
              t.type === "success" && "bg-emerald-50 border-emerald-200 text-emerald-900",
              t.type === "error" && "bg-red-50 border-red-200 text-red-900",
              t.type === "info" && "bg-slate-50 border-slate-200 text-slate-900",
              t.type === "warning" && "bg-amber-50 border-amber-200 text-amber-900",
            ].filter(Boolean).join(" ")}
            role="status"
            aria-live="polite"
         >
            <div className="mt-0.5">
              {t.type === "success" && <span aria-hidden>✅</span>}
              {t.type === "error" && <span aria-hidden>⚠️</span>}
              {t.type === "info" && <span aria-hidden>ℹ️</span>}
              {t.type === "warning" && <span aria-hidden>⚠️</span>}
            </div>
            <div className="flex-1 min-w-0">
              {t.title && <div className="font-semibold text-sm truncate">{t.title}</div>}
              {t.message && <div className="text-sm break-words whitespace-pre-line">{t.message}</div>}
            </div>
            <button
              type="button"
              onClick={() => remove(t.id)}
              className="ml-2 text-sm opacity-70 hover:opacity-100"
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
