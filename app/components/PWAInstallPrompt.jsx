"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "./ToastProvider.jsx";

function isStandalone() {
  // iOS & Android PWA installed checks
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const win = typeof window !== 'undefined' ? window : null;
  return !!(win?.matchMedia && win.matchMedia('(display-mode: standalone)').matches) || (nav && 'standalone' in nav && nav.standalone);
}

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent || "");
}

export default function PWAInstallPrompt() {
  const toast = useToast();
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(isStandalone());
  const deferredRef = useRef(null);

  // Register Service Worker
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // Install availability (Android/Chrome)
  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault();
      deferredRef.current = e;
      setCanInstall(true);
      try { toast.info("Cliquez sur l'icône de téléchargement pour installer l'application."); } catch {}
    };
    const onInstalled = () => {
      setInstalled(true);
      setCanInstall(false);
      deferredRef.current = null;
      try { toast.success("Application installée."); } catch {}
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [toast]);

  // iOS guidance: show button even if no event is provided
  const showButton = !installed && (canInstall || isIOS());

  const handleInstall = async () => {
    if (isIOS()) {
      // iOS does not support programmatic prompt
      try {
        toast.info("Sur iPhone/iPad: touchez Partager puis \"Ajouter à l'écran d'accueil\".");
      } catch {}
      return;
    }
    const evt = deferredRef.current;
    if (evt) {
      evt.prompt();
      const { outcome } = await evt.userChoice.catch(() => ({ outcome: 'dismissed' }));
      if (outcome === 'accepted') {
        try { toast.success("Installation démarrée."); } catch {}
        setCanInstall(false);
        deferredRef.current = null;
      } else {
        try { toast.warning("Installation annulée."); } catch {}
      }
    }
  };

  if (!showButton) return null;

  return (
    <button
      type="button"
      aria-label="Installer l'application"
      onClick={handleInstall}
      className="fixed z-30 bottom-5 right-5 p-3 rounded-full shadow-lg bg-orange-600 hover:bg-orange-700 text-white"
    >
      {/* Download icon */}
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M12 3a1 1 0 0 1 1 1v8.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 1.4-1.42L11 12.59V4a1 1 0 0 1 1-1Zm-7 14a1 1 0 0 1 1 1v2h12v-2a1 1 0 1 1 2 0v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a1 1 0 0 1 1-1Z"/>
      </svg>
    </button>
  );
}
