"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// Ensures a driver with an active order gets redirected to the driver dashboard
// and clears persisted order when it is completed or cancelled.
export default function ActiveDriverGuard() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const check = async () => {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("tri_token_driver") : null;
        const lastId = typeof window !== "undefined" ? localStorage.getItem("tri_last_driver_order_id") : null;
        if (!token) return; // not logged as driver

        // If we have a last accepted order, verify its status
        if (lastId) {
          const base = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
          const res = await fetch(`${base}/api/orders/${encodeURIComponent(lastId)}`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });
          if (res.status === 401) {
            try { localStorage.removeItem("tri_token_driver"); localStorage.removeItem("tri_user_driver"); } catch {}
            return;
          }
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data?.status) return;

          const status = String(data.status);
          const active = ["assigned", "in_progress"].includes(status);
          const done = ["completed", "cancelled", "canceled"].includes(status);

          if (done) {
            try { localStorage.removeItem("tri_last_driver_order_id"); } catch {}
            return;
          }
          if (active) {
            if (!pathname?.startsWith("/dashboard-conducteur")) {
              router.replace("/dashboard-conducteur");
            }
            return;
          }
        }

        // If no persisted order, optionally check if backend reports an active order
        // This covers cases where localStorage was cleared but backend still has state
        const base = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
        const res = await fetch(`${base}/api/orders/driver/active`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }).catch(() => null);
        if (res && res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data?.order?.id || data?.order?._id) {
            const id = String(data.order.id || data.order._id);
            try { localStorage.setItem("tri_last_driver_order_id", id); } catch {}
            if (!pathname?.startsWith("/dashboard-conducteur")) {
              router.replace("/dashboard-conducteur");
            }
          }
        }
      } catch {}
    };

    check();
    const onFocus = () => check();
    const onVisibility = () => { if (document.visibilityState === "visible") check(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, pathname]);

  return null;
}
