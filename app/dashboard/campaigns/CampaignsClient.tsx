"use client";

import { useState } from "react";

type HistoryRow = {
  id: string;
  subject: string;
  sent_count: number;
  created_at: string;
  scheduled_for: string | null;
  sent_at: string | null;
  remaining: number;
  channel: string;
  pushed: number;
};

const CHANNEL_ICON: Record<string, string> = {
  email: "💌",
  push: "🔔",
  both: "💌🔔",
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
  pushAudience,
  businessName,
  history,
  lastAt,
}: {
  hasAccess: boolean;
  isTrial: boolean;
  addonOn: boolean;
  hasSubscription: boolean;
  audience: number;
  pushAudience: number;
  businessName: string;
  history: HistoryRow[];
  lastAt: string | null;
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"now" | "later">("now");
  const [channel, setChannel] = useState<"both" | "email" | "push">("both");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [isErr, setIsErr] = useState(false);
  const [addonBusy, setAddonBusy] = useState(false);
  const [addonMsg, setAddonMsg] = useState<string | null>(null);

  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const maxDate = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);

  // Quota 24 h : uniquement pour les canaux incluant l'e-mail.
  // Les notifications push sont ILLIMITÉES.
  const quotaBlocked =
    channel !== "push" &&
    !!lastAt &&
    Date.now() - new Date(lastAt).getTime() < 24 * 3600e3;
  // audience disponible selon le canal choisi
  const channelAudience =
    channel === "email"
      ? audience
      : channel === "push"
      ? pushAudience
      : audience + pushAudience;
  const canSend =
    !busy &&
    !quotaBlocked &&
    channelAudience > 0 &&
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

  const effective = isTrial && !addonOn ? Math.min(audience, 10) : audience;

  async function send() {
    if (!canSend) return;
    const reach = [
      channel !== "push" ? `${effective} e-mail${effective > 1 ? "s" : ""}` : null,
      channel !== "email"
        ? `${pushAudience} notification${pushAudience > 1 ? "s" : ""} push`
        : null,
    ]
      .filter(Boolean)
      .join(" + ");
    const confirmMsg =
      mode === "later"
        ? `Programmer cette campagne pour le ${fmtDate(date)} (envoyée le matin) — ${reach} ?`
        : `Envoyer cette campagne maintenant — ${reach} ?`;
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
          channel,
          ...(mode === "later" ? { scheduledFor: date } : {}),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        const pushInfo =
          d.pushed > 0
            ? ` + ${d.pushed} notification${d.pushed > 1 ? "s" : ""} push 🔔`
            : "";
        setResult(
          d.scheduled
            ? `🕒 Campagne programmée pour le ${fmtDate(d.scheduledFor)} !`
            : d.remaining > 0
            ? `✅ ${d.sent} e-mails envoyés aujourd'hui${pushInfo} — les ${d.remaining} restants partiront automatiquement les prochains jours (envoi étalé).`
            : d.trialCapped
            ? `✅ Envoyée à ${d.sent} clients${pushInfo} (limite d'essai : 10 destinataires e-mail — l'option envoie à toute votre base).`
            : `✅ Campagne envoyée : ${d.sent} e-mail${d.sent > 1 ? "s" : ""}${pushInfo} !`
        );
        setSubject("");
        setMessage("");
        setTimeout(() => window.location.reload(), 2600);
      } else {
        setIsErr(true);
        setResult(
          d.error === "quota"
            ? "Une campagne a déjà été créée ces dernières 24 h."
            : d.error === "in_progress"
            ? "Une campagne est déjà en cours d'envoi ou programmée — attendez sa fin (ou annulez-la dans l'historique)."
            : d.error === "no_audience"
            ? "Aucun client n'a encore accepté de recevoir vos offres."
            : d.error === "no_push_audience"
            ? "Aucun appareil n'est abonné à vos notifications — vos clients les activent depuis leur carte de fidélité."
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
    if (!window.confirm("Annuler / stopper cette campagne ?")) return;
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
      <h1 className="dash-h1">Campagnes</h1>
      <p className="dash-sub">
        Envoyez une offre ou une actualité aux clients qui ont accepté de
        recevoir vos e-mails ou vos notifications (roue + carte de fidélité).
        {isTrial && !addonOn && (
          <>
            {" "}
            <b>Pendant l'essai : 10 destinataires max par campagne.</b> Avec
            l'option (15 €/mois), toute votre base est couverte, envoyée par
            vagues quotidiennes.
          </>
        )}
        {addonOn && (
          <>
            {" "}
            Les grandes campagnes partent par <b>vagues de 100 e-mails/jour</b>{" "}
            pour protéger votre réputation d'expéditeur.
          </>
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
          <div className="stat-icon">🔔</div>
          <div>
            <div className="stat-n">{pushAudience}</div>
            <div className="stat-l">Appareils abonnés aux notifs</div>
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
            ⏳ Une campagne e-mail a déjà été créée ces dernières 24 h — ça
            protège votre réputation d'expéditeur. 💡 Les{" "}
            <b>notifications push restent illimitées</b> : choisissez le canal
            « 🔔 Notif push seule » pour envoyer quand même.
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

        <div className="field" style={{ marginBottom: 4 }}>
          <span
            style={{ display: "block", marginBottom: 8, fontWeight: 600 }}
          >
            Canal d'envoi
          </span>
        </div>
        <div className="camp-when" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className={`addon-chip${channel === "both" ? " on" : ""}`}
            onClick={() => setChannel("both")}
          >
            <b>💌 + 🔔 Les deux</b>
            <span>
              {audience} e-mail{audience > 1 ? "s" : ""} + {pushAudience} notif
              {pushAudience > 1 ? "s" : ""}
            </span>
          </button>
          <button
            type="button"
            className={`addon-chip${channel === "email" ? " on" : ""}`}
            onClick={() => setChannel("email")}
          >
            <b>💌 E-mail seul</b>
            <span>
              {audience} client{audience > 1 ? "s" : ""} opt-in
            </span>
          </button>
          <button
            type="button"
            className={`addon-chip${channel === "push" ? " on" : ""}`}
            onClick={() => setChannel("push")}
          >
            <b>🔔 Notif push seule</b>
            <span>
              {pushAudience} appareil{pushAudience > 1 ? "s" : ""} · illimité
            </span>
          </button>
        </div>

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
            : channel === "push"
            ? `Envoyer la notif à ${pushAudience} appareil${
                pushAudience > 1 ? "s" : ""
              }`
            : channel === "email"
            ? `Envoyer à ${effective} client${effective > 1 ? "s" : ""}`
            : `Envoyer — ${effective} e-mail${
                effective > 1 ? "s" : ""
              } + ${pushAudience} notif${pushAudience > 1 ? "s" : ""}`}
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
                <b>
                  {CHANNEL_ICON[h.channel] ?? "💌"} {h.subject}
                </b>
                {h.sent_at ? (
                  <span>
                    Envoyée le {fmtDate(h.sent_at)} ·{" "}
                    {[
                      h.sent_count > 0
                        ? `${h.sent_count} e-mail${h.sent_count > 1 ? "s" : ""}`
                        : null,
                      h.pushed > 0
                        ? `${h.pushed} notif${h.pushed > 1 ? "s" : ""} push`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" + ") || "0 destinataire"}
                  </span>
                ) : h.remaining > 0 ? (
                  <span className="camp-pending">
                    📤 En cours : {h.sent_count} envoyés · {h.remaining}{" "}
                    restants (vagues quotidiennes){" "}
                    <button
                      className="camp-cancel"
                      onClick={() => cancelPending(h.id)}
                    >
                      Stopper
                    </button>
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
