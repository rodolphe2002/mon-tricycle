"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function SessionTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    try {
      const qs = searchParams?.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      const payload = { href, ts: Date.now() };
      localStorage.setItem("tri_last_route", JSON.stringify(payload));
      // If an order id is present in query, keep it in a dedicated key as well
      const id = searchParams?.get("id");
      if (id) localStorage.setItem("tri_last_order_id", String(id));
    } catch {}
  }, [pathname, searchParams]);

  return null;
}
