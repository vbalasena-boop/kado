"use client";

import { useState } from "react";
import Link from "next/link";
import { OPTIONAL_FEATURES, type FeatureFlags } from "@/lib/features";

// Bascules de la page de jeu (wheel_configs) exposées à l'admin.
const WHEEL_TOGGLES: { key: keyof WheelToggles; label: string; desc: string }[] =
  [
    {
      key: "review_invite",
      label: "Invitation à laisser un avis",
      desc: "Propose au client d'aller laisser un avis après avoir joué.",
    },
    {
      key: "convert_nudge",
      label: "Relance « ouvrir sa carte »",
      desc: "Relance par e-mail les joueurs qui n'ont pas de carte de fidélité.",
    },
    {
      key: "feedback_enabled",
      label: "Retours privés",
      desc: "Affiche « Un souci ? Dites-le nous » sur les pages jeu et fidélité.",
    },
    {
      key: "play_alerts",
      label: "Alertes de jeu",
      desc: "Notifie le commerçant à chaque partie jouée.",
    },
  ];

type WheelToggles = {
  review_invite: boolean;
  convert_nudge: boolean;
  feedback_enabled: boolean;
  play_alerts: boolean;
};

type Initial = {
  wheel: WheelToggles;
  orderTracking: boolean;
  features: FeatureFlags;
};

function Toggle({
  checked,
  onChange,
  label,
  desc,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  desc: string;
  disabled?: boolean;
}) {
  return (
    <label className="admin-toggle">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="admin-toggle-text">
        <b>{label}</b>
        <small>{desc}</small>
      </span>
    </label>
  );
}

export default function AdminSettings({
  businessId,
  slug,
  name,
  refCode,
  plan,
  subscriptionStatus,
  initial,
}: {
  businessId: string;
  slug: string;
  name: string;
  refCode: string | null;
  plan: string | null;
  subscriptionStatus: string | null;
  initial: Initial;
}) {
  const [wheel, setWheel] = useState<WheelToggles>(initial.wheel);
  const [orderTracking, setOrderTracking] = useState(initial.orderTracking);
  const [features, setFeatures] = useState<FeatureFlags>(initial.features);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isErr, setIsErr] = useState(false);

  function setWheelKey(key: keyof WheelToggles, v: boolean) {
    setWheel((w) => ({ ...w, [key]: v }));
  }
  function setFeatureKey(key: string, v: boolean) {
    setFeatures((f) => {
      const next = { ...f };
      if (v) next[key] = true;
      else delete next[key];
      return next;
    });
  }

  async function activateAll() {
    if (
      !confirm(
        "Tout activer sur cet établissement ?\n\n" +
          "Passe la formule en COMPLET et active toutes les options et fonctions " +
          "(pour vendre un compte clés en main). N'affecte ni l'abonnement " +
          "(essai/dates) ni le mode démo. Le paiement en ligne n'est activé que " +
          "si le compte Stripe Connect est déjà prêt."
      )
    )
      return;
    setBusy(true);
    setMsg(null);
    setIsErr(false);
    try {
      const res = await fetch(
        `/api/admin/business/${businessId}/activate-all`,
        { method: "POST" }
      );
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        if (Array.isArray(d.skipped) && d.skipped.length > 0) {
          setIsErr(true);
          setMsg(
            `Activé en partie. Non appliqué : ${d.skipped.join(", ")} ` +
              "(migrations 0072/0073 à jour ?)."
          );
        } else {
          // Reflète l'état « tout activé » sans recharger l'abonnement.
          setWheel({
            review_invite: true,
            convert_nudge: true,
            feedback_enabled: true,
            play_alerts: true,
          });
          setOrderTracking(true);
          setFeatures(
            Object.fromEntries(OPTIONAL_FEATURES.map((f) => [f.key, true]))
          );
          const payNote = d.onlinePayment
            ? " Paiement en ligne activé (Stripe Connect prêt)."
            : " Paiement en ligne laissé désactivé (Stripe Connect pas encore configuré).";
          setMsg(
            "Tout activé ✓ (formule Complet + toutes les fonctions)." + payNote
          );
        }
      } else {
        const d = await res.json().catch(() => ({}));
        setIsErr(true);
        setMsg(d.detail || d.error || "Échec de l'activation.");
      }
    } catch {
      setIsErr(true);
      setMsg("Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    setIsErr(false);
    try {
      const res = await fetch(`/api/admin/business/${businessId}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wheel, order_tracking: orderTracking, features }),
      });
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        if (Array.isArray(d.skipped) && d.skipped.length > 0) {
          setIsErr(true);
          setMsg(
            `Enregistré en partie. Non appliqué : ${d.skipped.join(", ")} ` +
              "(migration 0072 peut-être pas encore exécutée)."
          );
        } else {
          setMsg("Réglages enregistrés ✓");
        }
      } else {
        const d = await res.json().catch(() => ({}));
        setIsErr(true);
        setMsg(d.detail || d.error || "Échec de l'enregistrement.");
      }
    } catch {
      setIsErr(true);
      setMsg("Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Link href="/admin" className="admin-back">
        ← Retour à l'admin
      </Link>
      <h1 className="dash-h1">
        ⚙️ Réglages &amp; fonctions — {name}
      </h1>
      <p className="dash-sub">
        {refCode && <span className="admin-ref">{refCode}</span>}
        <a href={`/${slug}`} target="_blank" className="admin-slug">
          /{slug} ↗
        </a>
        {plan && <> · formule {plan}</>}
        {subscriptionStatus && <> · {subscriptionStatus}</>}
      </p>

      <div className="dash-card">
        <h2>⚡ Compte clés en main</h2>
        <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
          Active <b>tout</b> d'un coup (formule Complet + toutes les options et
          fonctions) — pratique pour vendre un établissement entièrement équipé.
          N'affecte ni l'abonnement ni le mode démo. Le paiement en ligne
          s'active seulement si Stripe Connect est prêt.
        </p>
        <button className="btn" onClick={activateAll} disabled={busy}>
          {busy ? "Activation…" : "⚡ Tout activer"}
        </button>
      </div>

      <div className="dash-card">
        <h2>Fonctions de la page</h2>
        <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
          Activez/désactivez ces fonctions à distance, sans vous connecter au
          compte du commerçant.
        </p>
        <div className="admin-toggles">
          {WHEEL_TOGGLES.map((t) => (
            <Toggle
              key={t.key}
              label={t.label}
              desc={t.desc}
              checked={wheel[t.key]}
              onChange={(v) => setWheelKey(t.key, v)}
              disabled={busy}
            />
          ))}
          <Toggle
            label="Suivi au comptoir (bipeur)"
            desc="Donne l'option « Suivi au comptoir » à cet établissement."
            checked={orderTracking}
            onChange={setOrderTracking}
            disabled={busy}
          />
        </div>
      </div>

      <div className="dash-card">
        <h2>Fonctions avancées (au cas par cas)</h2>
        <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
          Options spéciales activables sur ce seul établissement.
        </p>
        <div className="admin-toggles">
          {OPTIONAL_FEATURES.map((f) => (
            <Toggle
              key={f.key}
              label={f.label}
              desc={f.desc}
              checked={features[f.key] === true}
              onChange={(v) => setFeatureKey(f.key, v)}
              disabled={busy}
            />
          ))}
        </div>
      </div>

      <div className="save-bar">
        <button className="btn" onClick={save} disabled={busy}>
          {busy ? "Enregistrement…" : "Enregistrer les réglages"}
        </button>
        <Link
          className="btn-secondary"
          href={`/admin/business/${businessId}/personnaliser`}
        >
          🎨 Personnaliser la page…
        </Link>
        {msg && (
          <span className={isErr ? "save-msg is-err" : "save-msg"}>{msg}</span>
        )}
      </div>
    </>
  );
}
