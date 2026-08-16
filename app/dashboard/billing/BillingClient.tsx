"use client";

import { useState } from "react";

const PLANS = [
  {
    id: "roue",
    emoji: "🎡",
    label: "Roue",
    price: "29",
    features: [
      "Roue de la fortune illimitée",
      "Avis Google + Instagram",
      "Personnalisation complète",
      "QR code, stats, validation",
    ],
  },
  {
    id: "fidelite",
    emoji: "🎟️",
    label: "Fidélité",
    price: "19",
    features: [
      "Carte à tampons digitale",
      "Récompense personnalisable",
      "QR code client + validation",
      "Stats d'inscription",
    ],
  },
  {
    id: "complet",
    emoji: "⭐",
    label: "Complet",
    price: "44",
    features: [
      "Roue + carte de fidélité",
      "Toutes les fonctionnalités",
      "Le meilleur tarif combiné",
      "4 € d'économie / mois",
    ],
    recommended: true,
  },
];

const PLAN_LABEL: Record<string, string> = {
  roue: "Roue (29 €/mois)",
  fidelite: "Fidélité (19 €/mois)",
  complet: "Complet (44 €/mois)",
};

export default function BillingClient({
  hasSubscription,
  statusLabel,
  endsAt,
  success,
  currentPlan,
  isTrial,
}: {
  hasSubscription: boolean;
  statusLabel: string;
  endsAt: string | null;
  success: boolean;
  currentPlan: string;
  isTrial: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(currentPlan);
  const [changingPlan, setChangingPlan] = useState(false);
  const [planMsg, setPlanMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);

  async function go(path: string, body?: object) {
    setLoading(true);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await res.json().catch(() => ({}));
      if (d.url) window.location.href = d.url;
      else {
        alert(
          d.error === "no_price_configured"
            ? "Abonnement non configuré (tarif Stripe manquant)."
            : "Action indisponible."
        );
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }

  async function changePlan(planId: string) {
    setChangingPlan(true);
    setPlanMsg(null);
    try {
      const res = await fetch("/api/billing/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const d = await res.json().catch(() => ({}));
      if (d.ok) {
        setSelectedPlan(planId);
        setPlanMsg("Formule mise à jour !");
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setPlanMsg("Échec du changement. Réessayez.");
      }
    } catch {
      setPlanMsg("Connexion impossible.");
    } finally {
      setChangingPlan(false);
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
        Gérez votre formule et votre abonnement Kado.
      </p>

      {success && (
        <div className="redeem-result ok" style={{ marginBottom: 16 }}>
          <b>Merci ! Votre abonnement est actif.</b>
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
        <p style={{ marginBottom: 16 }}>
          Formule actuelle : <b>{PLAN_LABEL[currentPlan] || currentPlan}</b>
          {isTrial && (
            <span className="muted"> (toutes les fonctionnalités sont accessibles pendant l'essai)</span>
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
            onClick={() => go("/api/billing/checkout", { plan: selectedPlan })}
            disabled={loading}
          >
            {loading ? "…" : "S'abonner"}
          </button>
        )}
        {hasSubscription && (
          <p className="muted" style={{ marginTop: 12, fontSize: ".9rem" }}>
            Pour résilier ou changer de carte, utilisez « Gérer mon abonnement ».
          </p>
        )}
      </div>

      <div className="dash-card" style={{ maxWidth: 700 }}>
        <h2>{hasSubscription ? "Changer de formule" : "Choisir ma formule"}</h2>
        <p className="muted" style={{ marginBottom: 16 }}>
          {hasSubscription
            ? "Le changement prend effet immédiatement. Un prorata est appliqué sur votre prochaine facture."
            : "Sélectionnez la formule qui vous convient. L'essai gratuit inclut toutes les fonctionnalités."}
        </p>
        <div className="plan-grid billing">
          {PLANS.map((p) => {
            const active = (hasSubscription ? currentPlan : selectedPlan) === p.id;
            return (
              <button
                key={p.id}
                className={`plan-chip${active ? " on" : ""}${p.recommended ? " recommended" : ""}`}
                onClick={() => {
                  if (hasSubscription && p.id !== currentPlan) {
                    changePlan(p.id);
                  } else if (!hasSubscription) {
                    setSelectedPlan(p.id);
                  }
                }}
                disabled={changingPlan || (hasSubscription && active)}
              >
                <span className="plan-emoji">{p.emoji}</span>
                <b className="plan-name">{p.label}</b>
                <span className="plan-price">{p.price}&nbsp;€/mois</span>
                <ul className="plan-feats">
                  {p.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                {p.recommended && <span className="plan-badge">Recommandé</span>}
                {active && <span className="plan-current">Formule actuelle</span>}
              </button>
            );
          })}
        </div>
        {planMsg && (
          <p className="save-msg" style={{ marginTop: 12 }}>
            {planMsg}
          </p>
        )}
      </div>

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
