"use client";

import { useState } from "react";

const PLANS = [
  {
    id: "roue",
    emoji: "🎡",
    label: "Jeux",
    price: "29",
    features: [
      "3 jeux : roue, grattage, machine à sous",
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
      "Jeux + carte de fidélité",
      "Toutes les fonctionnalités",
      "Le meilleur tarif combiné",
      "4 € d'économie / mois",
    ],
    recommended: true,
  },
];

const PLAN_LABEL: Record<string, string> = {
  roue: "Jeux (29 €/mois)",
  fidelite: "Fidélité (19 €/mois)",
  complet: "Complet (44 €/mois)",
};

export default function BillingClient({
  hasSubscription,
  statusLabel,
  endsAt,
  success,
  setupOk = false,
  currentPlan,
  isTrial,
  setupPaid = false,
  setupOption = null,
  hasPhone = false,
  slug = "",
  initialAddress = "",
  initialPhone = "",
}: {
  hasSubscription: boolean;
  statusLabel: string;
  endsAt: string | null;
  success: boolean;
  setupOk?: boolean;
  currentPlan: string;
  isTrial: boolean;
  setupPaid?: boolean;
  setupOption?: string | null;
  hasPhone?: boolean;
  slug?: string;
  initialAddress?: string;
  initialPhone?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(currentPlan);
  const [setupOpt, setSetupOpt] = useState<"none" | "remote" | "onsite">("none");
  const [postOpt, setPostOpt] = useState<"remote" | "onsite">("remote");
  const [setupPhone, setSetupPhone] = useState("");
  const [setupAddress, setSetupAddress] = useState(initialAddress);
  const phoneNeeded = !hasPhone;
  const phoneOk = setupPhone.replace(/\D/g, "").length >= 9;
  const addressOk = setupAddress.trim().length >= 8;

  // Coordonnées modifiables à tout moment
  const [profAddress, setProfAddress] = useState(initialAddress);
  const [profPhone, setProfPhone] = useState(initialPhone);
  const [profBusy, setProfBusy] = useState(false);
  const [profMsg, setProfMsg] = useState<string | null>(null);

  async function saveProfile() {
    setProfBusy(true);
    setProfMsg(null);
    try {
      const res = await fetch("/api/dashboard/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: profAddress.trim(),
          phone: profPhone.trim(),
        }),
      });
      setProfMsg(res.ok ? "✅ Coordonnées enregistrées !" : "Échec de l'enregistrement.");
    } catch {
      setProfMsg("Connexion impossible.");
    } finally {
      setProfBusy(false);
    }
  }
  const [changingPlan, setChangingPlan] = useState(false);
  const [planMsg, setPlanMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);
  const [refCopied, setRefCopied] = useState(false);

  async function copyReferral() {
    const url = `${window.location.origin}/login?signup=1&p=${slug}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Kado",
          text: `Essaie Kado pour ton commerce (14 jours gratuits) : ${url}`,
          url,
        });
        return;
      }
    } catch {
      /* partage annulé */
    }
    try {
      await navigator.clipboard.writeText(url);
      setRefCopied(true);
      setTimeout(() => setRefCopied(false), 2500);
    } catch {
      /* ignore */
    }
  }

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
            : d.error === "setup_not_configured"
            ? "Option installation non configurée (tarif Stripe manquant)."
            : d.detail
            ? `Erreur Stripe : ${d.detail}`
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
      {setupOk && (
        <div className="redeem-result ok" style={{ marginBottom: 16 }}>
          <b>🛠️ Installation réservée ! Nous vous contactons sous 24 h ouvrées.</b>
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
          <>
            <div className="setup-addon">
              <b>🛠️ Installation clé en main <span className="setup-addon-tag">option</span></b>
              <p className="muted">
                On configure tout pour vous : roue à vos couleurs, cadeaux
                adaptés à votre métier, liens Google &amp; Instagram, carte de
                fidélité et affiche prête à imprimer. Réglée une seule fois,
                avec votre premier paiement.
              </p>
              <div className="setup-addon-opts">
                <button
                  type="button"
                  className={`addon-chip${setupOpt === "none" ? " on" : ""}`}
                  onClick={() => setSetupOpt("none")}
                >
                  <b>Non merci</b>
                  <span>je configure moi-même</span>
                </button>
                <button
                  type="button"
                  className={`addon-chip${setupOpt === "remote" ? " on" : ""}`}
                  onClick={() => setSetupOpt("remote")}
                >
                  <b>À distance · 79 €</b>
                  <span>config complète + affiche PDF</span>
                </button>
                <button
                  type="button"
                  className={`addon-chip${setupOpt === "onsite" ? " on" : ""}`}
                  onClick={() => setSetupOpt("onsite")}
                >
                  <b>Sur place · 129 €</b>
                  <span>+ pose de l'affiche &amp; formation</span>
                </button>
              </div>
              {setupOpt === "onsite" && (
                <label className="field" style={{ marginTop: 12, marginBottom: 0 }}>
                  <span>Adresse du commerce (pour venir vous installer)</span>
                  <input
                    type="text"
                    placeholder="12 rue des Fleurs, 75011 Paris"
                    value={setupAddress}
                    onChange={(e) => setSetupAddress(e.target.value)}
                    maxLength={200}
                  />
                </label>
              )}
            </div>
            <button
              className="btn"
              onClick={() =>
                go("/api/billing/checkout", {
                  plan: selectedPlan,
                  ...(setupOpt !== "none" ? { setup: setupOpt } : {}),
                  ...(setupOpt === "onsite"
                    ? { address: setupAddress.trim() }
                    : {}),
                })
              }
              disabled={loading || (setupOpt === "onsite" && !addressOk)}
            >
              {loading
                ? "…"
                : setupOpt === "none"
                ? "S'abonner"
                : `S'abonner + installation (${setupOpt === "remote" ? "79" : "129"} €)`}
            </button>
          </>
        )}
        {hasSubscription && (
          <p className="muted" style={{ marginTop: 12, fontSize: ".9rem" }}>
            Pour résilier ou changer de carte, utilisez « Gérer mon abonnement ».
          </p>
        )}
      </div>

      <div className="dash-card" style={{ maxWidth: 520 }}>
        <h2>📍 Mes coordonnées</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          Utilisées pour vous accompagner — indispensables pour
          l'installation <b>sur place</b>.
        </p>
        <label className="field">
          <span>Adresse du commerce</span>
          <input
            type="text"
            placeholder="12 rue des Fleurs, 75011 Paris"
            value={profAddress}
            onChange={(e) => setProfAddress(e.target.value)}
            maxLength={200}
          />
        </label>
        <label className="field">
          <span>Téléphone</span>
          <input
            type="tel"
            inputMode="tel"
            placeholder="06 12 34 56 78"
            value={profPhone}
            onChange={(e) => setProfPhone(e.target.value)}
            maxLength={20}
          />
        </label>
        <button
          className="btn"
          onClick={saveProfile}
          disabled={profBusy || (!profAddress.trim() && !profPhone.trim())}
        >
          {profBusy ? "…" : "Enregistrer mes coordonnées"}
        </button>
        {profMsg && (
          <p className="save-msg" style={{ marginTop: 10 }}>
            {profMsg}
          </p>
        )}
      </div>

      {hasSubscription && (
        <div className="dash-card" style={{ maxWidth: 520 }}>
          <h2>🛠️ Installation clé en main</h2>
          {setupPaid ? (
            <div className="redeem-result ok">
              <b>
                Installation{" "}
                {setupOption === "onsite" ? "sur place" : "à distance"} réservée ✓
              </b>
              <div className="muted" style={{ marginTop: 6 }}>
                Nous vous contactons sous 24 h ouvrées pour tout configurer.
                Une question ? Écrivez-nous en répondant à l'e-mail de
                confirmation.
              </div>
            </div>
          ) : (
            <>
              <p className="muted" style={{ marginBottom: 12 }}>
                Pas le temps de configurer votre roue, vos cadeaux ou votre
                carte de fidélité ? On s'occupe de tout, en une seule fois.
              </p>
              <div className="setup-addon-opts" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <button
                  type="button"
                  className={`addon-chip${postOpt === "remote" ? " on" : ""}`}
                  onClick={() => setPostOpt("remote")}
                >
                  <b>À distance · 79 €</b>
                  <span>config complète + affiche PDF</span>
                </button>
                <button
                  type="button"
                  className={`addon-chip${postOpt === "onsite" ? " on" : ""}`}
                  onClick={() => setPostOpt("onsite")}
                >
                  <b>Sur place · 129 €</b>
                  <span>+ pose de l'affiche &amp; formation</span>
                </button>
              </div>
              {phoneNeeded && (
                <label className="field" style={{ marginTop: 14 }}>
                  <span>Votre téléphone (pour organiser l'installation)</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="06 12 34 56 78"
                    value={setupPhone}
                    onChange={(e) => setSetupPhone(e.target.value)}
                    maxLength={20}
                  />
                </label>
              )}
              {postOpt === "onsite" && (
                <label className="field" style={{ marginTop: 14 }}>
                  <span>Adresse du commerce (pour venir vous installer)</span>
                  <input
                    type="text"
                    placeholder="12 rue des Fleurs, 75011 Paris"
                    value={setupAddress}
                    onChange={(e) => setSetupAddress(e.target.value)}
                    maxLength={200}
                  />
                </label>
              )}
              <button
                className="btn"
                style={{ marginTop: 14 }}
                onClick={() =>
                  go("/api/billing/setup", {
                    setup: postOpt,
                    ...(phoneNeeded ? { phone: setupPhone.trim() } : {}),
                    ...(postOpt === "onsite"
                      ? { address: setupAddress.trim() }
                      : {}),
                  })
                }
                disabled={
                  loading ||
                  (phoneNeeded && !phoneOk) ||
                  (postOpt === "onsite" && !addressOk)
                }
              >
                {loading
                  ? "…"
                  : `Réserver l'installation (${postOpt === "remote" ? "79" : "129"} €)`}
              </button>
              {phoneNeeded && !phoneOk && setupPhone.length > 0 && (
                <p className="err" style={{ marginTop: 8 }}>
                  Entrez un numéro valide (ex. 06 12 34 56 78).
                </p>
              )}
              <p className="muted" style={{ marginTop: 10, fontSize: ".85rem" }}>
                Paiement unique et sécurisé via Stripe. Réalisée sous 72 h
                ouvrées après prise de contact.
              </p>
            </>
          )}
        </div>
      )}

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

      <div className="dash-card" style={{ maxWidth: 520 }}>
        <h2>🤝 Parrainez un commerçant</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          Vous connaissez un commerçant à qui Kado ferait du bien ? Partagez
          votre lien : dès qu'il <b>s'abonne et règle son premier
          paiement</b>, <b>votre prochain mois est offert</b>. Sans limite —
          chaque filleul abonné et payant = 1 mois gratuit.
        </p>
        <div className="ref-link-box">
          <code>kado-app.fr/login?signup=1&p={slug}</code>
        </div>
        <button className="btn" onClick={copyReferral} style={{ marginTop: 12 }}>
          {refCopied ? "✅ Lien copié !" : "Partager mon lien de parrainage"}
        </button>
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
