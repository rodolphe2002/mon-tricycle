"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Redirect the user back to the active order tracking screens if an order is ongoing
// Active statuses -> redirect rules:
// - searching | pending | assigned => /commande-acceptee?id=...
// - in_progress => /trajet-en-cours?id=...
// - cancelled | completed => clear last order id
export default function ActiveOrderGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    let stopped = false;
    const check = async () => {
      try {
        const lastId = typeof window !== "undefined" ? localStorage.getItem("tri_last_order_id") : null;
        const token = typeof window !== "undefined" ? localStorage.getItem("tri_token_client") : null;
        if (!lastId || !token) return;

        const base = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
        const res = await fetch(`${base}/api/orders/${encodeURIComponent(lastId)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        // If unauthorized, clear session-related storage and stop
        if (res.status === 401) {
          try {
            localStorage.removeItem("tri_token_client");
            localStorage.removeItem("tri_user_client");
          } catch {}
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.status) return;

        const status = String(data.status);
        const isActive = ["searching", "pending", "assigned", "in_progress"].includes(status);
        const isDone = ["cancelled", "canceled", "completed"].includes(status);

        if (isDone) {
          try { localStorage.removeItem("tri_last_order_id"); } catch {}
          return;
        }
        if (!isActive) return;

        const q = `?id=${encodeURIComponent(lastId)}`;
        const onCommandeAcceptee = pathname?.startsWith("/commande-acceptee");
        const onTrajetEnCours = pathname?.startsWith("/trajet-en-cours");
        const currentId = params?.get("id") || "";

        if (status === "in_progress") {
          if (!onTrajetEnCours || currentId !== String(lastId)) {
            router.replace(`/trajet-en-cours${q}`);
          }
        } else {
          if (!onCommandeAcceptee || currentId !== String(lastId)) {
            router.replace(`/commande-acceptee${q}`);
          }
        }
      } catch {
        // silent fail: guard should never break the app
      }
    };

    // Initial check on mount
    check();

    // Re-check when the tab/app regains focus or becomes visible again
    const onFocus = () => check();
    const onVisibility = () => { if (document.visibilityState === "visible") check(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, pathname, params]);

  return null;
}
