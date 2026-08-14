"use client";

import { useState } from "react";

export default function BillingClient({
  hasSubscription,
  statusLabel,
  endsAt,
  success,
}: {
  hasSubscription: boolean;
  statusLabel: string;
  endsAt: string | null;
  success: boolean;
}) {
  const [loading, setLoading] = useState(false);

  async function go(path: string) {
    setLoading(true);
    try {
      const res = await fetch(path, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (d.url) window.location.href = d.url;
      else {
        alert(
          d.error === "no_price_configured"
            ? "Abonnement non configuré (STRIPE_PRICE_ID manquant)."
            : "Action indisponible."
        );
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="dash-h1">Abonnement</h1>
      <p className="dash-sub">
        Gérez votre abonnement Kado. L'accès à votre jeu se coupe
        automatiquement en cas de non-paiement.
      </p>

      {success && (
        <div className="redeem-result ok" style={{ marginBottom: 16 }}>
          <b>✅ Merci ! Votre abonnement est actif.</b>
        </div>
      )}

      <div className="dash-card" style={{ maxWidth: 520 }}>
        <h2>Votre formule</h2>
        <p className="dash-sub" style={{ marginBottom: 16 }}>
          Statut :{" "}
          <span className={`pill ${hasSubscription ? "active" : "suspended"}`}>
            {statusLabel}
          </span>
          {endsAt && (
            <>
              {" "}
              · prochaine échéance :{" "}
              {new Date(endsAt).toLocaleDateString("fr-FR")}
            </>
          )}
        </p>

        {hasSubscription ? (
          <button
            className="btn"
            onClick={() => go("/api/billing/portal")}
            disabled={loading}
          >
            {loading ? "…" : "Gérer mon abonnement"}
          </button>
        ) : (
          <button
            className="btn"
            onClick={() => go("/api/billing/checkout")}
            disabled={loading}
          >
            {loading ? "…" : "S'abonner"}
          </button>
        )}
      </div>
    </>
  );
}
