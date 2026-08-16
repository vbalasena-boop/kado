"use client";

import { useState } from "react";

type HistoryRow = { subject: string; sent_count: number; created_at: string };

export default function CampaignsClient({
  audience,
  businessName,
  history,
  lastAt,
}: {
  audience: number;
  businessName: string;
  history: HistoryRow[];
  lastAt: string | null;
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [isErr, setIsErr] = useState(false);

  const quotaBlocked =
    !!lastAt && Date.now() - new Date(lastAt).getTime() < 24 * 3600e3;
  const canSend =
    !busy && !quotaBlocked && audience > 0 && subject.trim() && message.trim().length >= 10;

  async function send() {
    if (!canSend) return;
    if (
      !window.confirm(
        `Envoyer cette campagne à ${audience} client${audience > 1 ? "s" : ""} ? Cette action est immédiate.`
      )
    )
      return;
    setBusy(true);
    setResult(null);
    setIsErr(false);
    try {
      const res = await fetch("/api/dashboard/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setResult(`✅ Campagne envoyée à ${d.sent} client${d.sent > 1 ? "s" : ""} !`);
        setSubject("");
        setMessage("");
        setTimeout(() => window.location.reload(), 1800);
      } else {
        setIsErr(true);
        setResult(
          d.error === "quota"
            ? "Vous avez déjà envoyé une campagne ces dernières 24 h."
            : d.error === "no_audience"
            ? "Aucun client n'a encore accepté de recevoir vos offres."
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

  return (
    <>
      <h1 className="dash-h1">Campagnes e-mail</h1>
      <p className="dash-sub">
        Envoyez une offre ou une actualité aux clients qui ont accepté de
        recevoir vos e-mails (roue + carte de fidélité).
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
            <div className="stat-n">{history.length}</div>
            <div className="stat-l">Campagnes envoyées</div>
          </div>
        </div>
      </div>

      <div className="dash-card" style={{ maxWidth: 640 }}>
        <h2>Nouvelle campagne</h2>
        {quotaBlocked && (
          <p className="camp-quota">
            ⏳ Une campagne a déjà été envoyée ces dernières 24 h. Vous pourrez
            en envoyer une nouvelle demain — ça protège votre réputation
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
        <p className="muted" style={{ marginBottom: 14 }}>
          Chaque e-mail part aux couleurs de Kado avec le nom de votre commerce,
          un bouton vers votre page, et le lien de désinscription obligatoire.
          Les réponses arrivent directement dans votre boîte mail.
        </p>
        <button className="btn" onClick={send} disabled={!canSend}>
          {busy
            ? "Envoi en cours…"
            : `Envoyer à ${audience} client${audience > 1 ? "s" : ""}`}
        </button>
        {result && (
          <p className={isErr ? "save-msg is-err" : "save-msg"} style={{ marginTop: 12 }}>
            {result}
          </p>
        )}
      </div>

      <div className="dash-card" style={{ maxWidth: 640 }}>
        <h2>Historique</h2>
        {history.length === 0 ? (
          <p className="muted">Aucune campagne envoyée pour l'instant.</p>
        ) : (
          <ul className="camp-history">
            {history.map((h) => (
              <li key={h.created_at}>
                <b>{h.subject}</b>
                <span>
                  {new Date(h.created_at).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}{" "}
                  · {h.sent_count} destinataire{h.sent_count > 1 ? "s" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
