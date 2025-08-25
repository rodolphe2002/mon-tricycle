"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function SuiviTokenPage() {
  const router = useRouter();
  const p = useParams();
  const token = p?.token;
  const [status, setStatus] = useState("Chargement du lien de suivi…");

  useEffect(() => {
    const run = async () => {
      if (!token) return;
      const base = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
      try {
        const res = await fetch(`${base}/api/share/${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          // 404/410 => expired
          router.replace("/suivi-expire");
          return;
        }
        const to = data?.redirectTo;
        if (to && typeof to === "string") {
          router.replace(to);
          return;
        }
        // Fallback
        router.replace("/");
      } catch (e) {
        setStatus("Réseau indisponible. Réessayez plus tard.");
        setTimeout(() => router.replace("/suivi-expire"), 1000);
      }
    };
    run();
  }, [token, router]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 18, fontWeight: 600 }}>Suivi du trajet</div>
      <div style={{ opacity: 0.8 }}>{status}</div>
    </div>
  );
}
