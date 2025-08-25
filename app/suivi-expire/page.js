"use client";

export default function SuiviExpirePage() {
  return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 520, textAlign: "center" }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>Lien de suivi expiré</h1>
        <p style={{ opacity: 0.85, lineHeight: 1.5 }}>
          Ce lien de suivi n'est plus valide. La course a peut-être été terminée ou annulée,
          ou le lien a été révoqué par le client.
        </p>
        <div style={{ height: 16 }} />
        <a href="/" style={{
          display: "inline-block",
          background: "#111827",
          color: "#fff",
          padding: "10px 16px",
          borderRadius: 8,
          textDecoration: "none",
          fontWeight: 600,
        }}>Retour à l'accueil</a>
      </div>
    </div>
  );
}
