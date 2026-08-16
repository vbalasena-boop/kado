"use client";

import { useState } from "react";

type HistoryRow = {
  id: string;
  subject: string;
  sent_count: number;
  created_at: string;
  scheduled_for: string | null;
  sent_at: string | null;
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function CampaignsClient({
  hasAccess,
  isTrial,
  addonOn,
  hasSubscription,
  audience,
  businessName,
  history,
  lastAt,
}: {
  hasAccess: boolean;
  isTrial: boolean;
  addonOn: boolean;
  hasSubscription: boolean;
  audience: number;
  businessName: string;
  history: HistoryRow[];
  lastAt: string | null;
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"now" | "later">("now");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [isErr, setIsErr] = useState(false);
  const [addonBusy, setAddonBusy] = useState(false);
  const [addonMsg, setAddonMsg] = useState<string | null>(null);

  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const maxDate = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);

  const quotaBlocked =
    !!lastAt && Date.now() - new Date(lastAt).getTime() < 24 * 3600e3;
  const canSend =
    !busy &&
    !quotaBlocked &&
    audience > 0 &&
    subject.trim() &&
    message.trim().length >= 10 &&
    (mode === "now" || !!date);

  async function toggleAddon(enable: boolean) {
    setAddonBusy(true);
    setAddonMsg(null);
    try {
      const res = await fetch("/api/billing/campaigns-addon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setAddonMsg(
          enable
            ? "✅ Option activée ! Rechargement…"
            : "Option désactivée. Rechargement…"
        );
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setAddonMsg(
          d.error === "subscribe_first"
            ? "Abonnez-vous d'abord à une formule (page Abonnement)."
            : d.error === "addon_not_configured"
            ? "Option non configurée (tarif Stripe manquant)."
            : d.detail
            ? `Erreur Stripe : ${d.detail}`
            : "Action indisponible."
        );
      }
    } catch {
      setAddonMsg("Connexion impossible.");
    } finally {
      setAddonBusy(false);
    }
  }

  async function send() {
    if (!canSend) return;
    const confirmMsg =
      mode === "later"
        ? `Programmer cette campagne pour le ${fmtDate(date)} (envoyée le matin) à ~${audience} client${audience > 1 ? "s" : ""} ?`
        : `Envoyer cette campagne maintenant à ${audience} client${audience > 1 ? "s" : ""} ?`;
    if (!window.confirm(confirmMsg)) return;
    setBusy(true);
    setResult(null);
    setIsErr(false);
    try {
      const res = await fetch("/api/dashboard/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
          ...(mode === "later" ? { scheduledFor: date } : {}),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setResult(
          d.scheduled
            ? `🕒 Campagne programmée pour le ${fmtDate(d.scheduledFor)} !`
            : `✅ Campagne envoyée à ${d.sent} client${d.sent > 1 ? "s" : ""} !`
        );
        setSubject("");
        setMessage("");
        setTimeout(() => window.location.reload(), 1800);
      } else {
        setIsErr(true);
        setResult(
          d.error === "quota"
            ? "Une campagne a déjà été créée ces dernières 24 h."
            : d.error === "no_audience"
            ? "Aucun client n'a encore accepté de recevoir vos offres."
            : d.error === "addon_required"
            ? "L'option Campagnes n'est pas active sur votre compte."
            : d.error === "bad_date"
            ? "Choisissez une date entre demain et dans 60 jours."
            : d.error === "migration_missing"
            ? "La base n'est pas à jour (migration campagnes manquante)."
            : "L'envoi a échoué. Réessayez."
        );
      }
    } catch {
      setIsErr(true);
      setResult("Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelPending(id: string) {
    if (!window.confirm("Annuler cette campagne programmée ?")) return;
    try {
      await fetch("/api/dashboard/campaigns", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      window.location.reload();
    } catch {
      /* ignore */
    }
  }

  // ── Écran verrouillé : option non active ──
  if (!hasAccess) {
    return (
      <>
        <h1 className="dash-h1">Campagnes e-mail</h1>
        <p className="dash-sub">
          Envoyez vos offres à la base clients que Kado construit pour vous.
        </p>
        <div className="dash-card" style={{ maxWidth: 560 }}>
          <div className="fid-lock-banner">
            <div>
              <b>💌 Option Campagnes — 15 €/mois</b>
              <span>
                Envoyez vos promos, nouveautés et événements aux{" "}
                {audience > 0 ? `${audience} client${audience > 1 ? "s" : ""}` : "clients"}{" "}
                qui ont accepté vos offres. Envoi immédiat ou programmé,
                réponses dans votre boîte mail, désinscription gérée
                automatiquement. Sans engagement, résiliable à tout moment.
              </span>
            </div>
          </div>
          {hasSubscription ? (
            <button
              className="btn"
              onClick={() => toggleAddon(true)}
              disabled={addonBusy}
            >
              {addonBusy ? "…" : "Activer l'option (+15 €/mois)"}
            </button>
          ) : (
            <p className="muted">
              Abonnez-vous d'abord à une formule depuis la page{" "}
              <a href="/dashboard/billing">Abonnement</a>, puis activez l'option
              ici.
            </p>
          )}
          {addonMsg && (
            <p className="save-msg" style={{ marginTop: 10 }}>
              {addonMsg}
            </p>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="dash-h1">Campagnes e-mail</h1>
      <p className="dash-sub">
        Envoyez une offre ou une actualité aux clients qui ont accepté de
        recevoir vos e-mails (roue + carte de fidélité).
        {isTrial && !addonOn && (
          <> <b>Inclus pendant votre essai</b> — ensuite en option (15 €/mois).</>
        )}
      </p>

      <div className="stat-grid" style={{ marginBottom: 18 }}>
        <div className="stat">
          <div className="stat-icon">💌</div>
          <div>
            <div className="stat-n">{audience}</div>
            <div className="stat-l">Clients joignables (opt-in)</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icon">📤</div>
          <div>
            <div className="stat-n">{history.filter((h) => h.sent_at).length}</div>
            <div className="stat-l">Campagnes envoyées</div>
          </div>
        </div>
      </div>

      <div className="dash-card" style={{ maxWidth: 640 }}>
        <h2>Nouvelle campagne</h2>
        {quotaBlocked && (
          <p className="camp-quota">
            ⏳ Une campagne a déjà été créée ces dernières 24 h. Vous pourrez en
            créer une nouvelle demain — ça protège votre réputation
            d'expéditeur.
          </p>
        )}
        <label className="field">
          <span>Objet de l'e-mail</span>
          <input
            type="text"
            maxLength={90}
            placeholder="Ex. -20 % ce week-end pour nos fidèles !"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Votre message</span>
          <textarea
            className="camp-textarea"
            rows={7}
            maxLength={2500}
            placeholder={`Bonjour !\n\nCe week-end, profitez de -20 % sur tout chez ${businessName}. Montrez cet e-mail en caisse.\n\nÀ très vite !`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </label>

        <div className="camp-when">
          <button
            type="button"
            className={`addon-chip${mode === "now" ? " on" : ""}`}
            onClick={() => setMode("now")}
          >
            <b>Envoyer maintenant</b>
            <span>part dans la minute</span>
          </button>
          <button
            type="button"
            className={`addon-chip${mode === "later" ? " on" : ""}`}
            onClick={() => setMode("later")}
          >
            <b>Programmer</b>
            <span>envoyée le matin du jour choisi</span>
          </button>
        </div>
        {mode === "later" && (
          <label className="field" style={{ marginTop: 12 }}>
            <span>Date d'envoi (le matin, vers 10 h)</span>
            <input
              type="date"
              min={tomorrow}
              max={maxDate}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        )}

        <p className="muted" style={{ margin: "12px 0 14px" }}>
          Chaque e-mail part au nom de votre commerce, avec un bouton vers votre
          page et le lien de désinscription obligatoire. Les réponses arrivent
          directement dans votre boîte mail.
        </p>
        <button className="btn" onClick={send} disabled={!canSend}>
          {busy
            ? "…"
            : mode === "later"
            ? "Programmer la campagne"
            : `Envoyer à ${audience} client${audience > 1 ? "s" : ""}`}
        </button>
        {result && (
          <p
            className={isErr ? "save-msg is-err" : "save-msg"}
            style={{ marginTop: 12 }}
          >
            {result}
          </p>
        )}
      </div>

      <div className="dash-card" style={{ maxWidth: 640 }}>
        <h2>Historique</h2>
        {history.length === 0 ? (
          <p className="muted">Aucune campagne pour l'instant.</p>
        ) : (
          <ul className="camp-history">
            {history.map((h) => (
              <li key={h.id}>
                <b>{h.subject}</b>
                {h.sent_at ? (
                  <span>
                    Envoyée le {fmtDate(h.sent_at)} · {h.sent_count}{" "}
                    destinataire{h.sent_count > 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="camp-pending">
                    🕒 Programmée pour le{" "}
                    {h.scheduled_for ? fmtDate(h.scheduled_for) : "—"}{" "}
                    <button
                      className="camp-cancel"
                      onClick={() => cancelPending(h.id)}
                    >
                      Annuler
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {addonOn && (
        <div className="dash-card" style={{ maxWidth: 640 }}>
          <h2>Option Campagnes</h2>
          <p className="muted" style={{ marginBottom: 10 }}>
            Option active — 15 €/mois, sans engagement.
          </p>
          <button
            className="btn-secondary"
            onClick={() => toggleAddon(false)}
            disabled={addonBusy}
          >
            {addonBusy ? "…" : "Désactiver l'option"}
          </button>
          {addonMsg && (
            <p className="save-msg" style={{ marginTop: 10 }}>
              {addonMsg}
            </p>
          )}
        </div>
      )}
    </>
  );
}
