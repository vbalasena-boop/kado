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
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);

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

  async function deleteAccount() {
    if (confirm.trim().toUpperCase() !== "SUPPRIMER") return;
    if (
      !window.confirm(
        "Dernière confirmation : supprimer définitivement votre compte et toutes vos données ? Cette action est irréversible."
      )
    )
      return;
    setDeleting(true);
    setDelErr(null);
    try {
      const res = await fetch("/api/dashboard/delete-account", {
        method: "POST",
      });
      if (res.ok) {
        window.location.href = "/?deleted=1";
        return;
      }
      setDelErr("La suppression a échoué. Réessayez dans un instant.");
    } catch {
      setDelErr("Connexion impossible. Réessayez.");
    } finally {
      setDeleting(false);
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
        {hasSubscription && (
          <p className="muted" style={{ marginTop: 12, fontSize: ".9rem" }}>
            Pour résilier ou changer de carte, utilisez « Gérer mon abonnement ».
            La résiliation prend effet à la fin de la période déjà payée.
          </p>
        )}
      </div>

      {/* Zone dangereuse — suppression du compte */}
      <div className="danger-zone" style={{ maxWidth: 520 }}>
        <h2>Supprimer mon compte</h2>
        <p>
          Supprime <b>définitivement</b> votre établissement, votre roue, vos
          cadeaux et l'historique des tours. Votre abonnement est résilié
          automatiquement. <b>Cette action est irréversible.</b>
        </p>
        <label className="danger-label" htmlFor="confirm-del">
          Pour confirmer, tapez <b>SUPPRIMER</b> ci-dessous :
        </label>
        <input
          id="confirm-del"
          className="onboarding-input"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="SUPPRIMER"
          autoComplete="off"
        />
        {delErr && <p className="onboarding-err">{delErr}</p>}
        <button
          className="btn-danger"
          onClick={deleteAccount}
          disabled={deleting || confirm.trim().toUpperCase() !== "SUPPRIMER"}
        >
          {deleting ? "Suppression…" : "Supprimer définitivement mon compte"}
        </button>
      </div>
    </>
  );
}
