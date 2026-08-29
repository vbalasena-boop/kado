"use client";

import { useEffect, useState } from "react";
import { subscribeWithCurrentKey } from "@/lib/push-client";
import type { Highlight } from "@/lib/highlight";
import HighlightCard from "@/components/HighlightCard";
import FeedbackForm from "@/components/FeedbackForm";

type CardData = {
  code: string;
  stamps: number;
  goal: number;
  rewardsEarned: number;
  rewardReady: boolean;
  reward: string;
  rewardEmoji: string;
  birthdayEnabled?: boolean;
  referralEnabled?: boolean;
  referralCount?: number;
  referralRewarded?: number;
  birthdaySet?: boolean;
  marketingOk?: boolean;
  unsubscribed?: boolean;
};

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export default function LoyaltyCard({
  slug,
  name,
  logoUrl,
  goal,
  reward,
  rewardEmoji,
  stampEmoji = "⭐",
  parrain = null,
  highlight = null,
  feedbackEnabled = false,
}: {
  slug: string;
  name: string;
  logoUrl: string | null;
  goal: number;
  reward: string;
  rewardEmoji: string;
  stampEmoji?: string;
  parrain?: string | null;
  highlight?: Highlight | null;
  feedbackEnabled?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [card, setCard] = useState<CardData | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [bDay, setBDay] = useState("");
  const [bMonth, setBMonth] = useState("");
  const [bBusy, setBBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resubState, setResubState] = useState<
    "idle" | "busy" | "sent" | "error"
  >(
    "idle"
  );
  const [pushState, setPushState] = useState<
    "unsupported" | "off" | "busy" | "on"
  >("unsupported");
  const [installHint, setInstallHint] = useState<"ios" | "android" | null>(
    null
  );

  // Proposer d'ajouter la carte à l'écran d'accueil (sauf déjà installée
  // ou déjà refusée sur cet appareil)
  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if ((navigator as any).standalone) return; // iOS installé
    if (localStorage.getItem(`kado-a2hs-${slug}`) === "1") return;
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) setInstallHint("ios");
    else if (/Android/i.test(ua)) setInstallHint("android");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismissInstall() {
    localStorage.setItem(`kado-a2hs-${slug}`, "1");
    setInstallHint(null);
  }

  // Notifications d'offres : cet appareil est-il déjà abonné ?
  useEffect(() => {
    if (!("PushManager" in window) || !("serviceWorker" in navigator)) return;
    if (localStorage.getItem(`kado-push-${slug}`) === "1") setPushState("on");
    else setPushState("off");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Abonne l'appareil aux offres de ce commerce (opt-in navigateur). */
  async function enableOffersPush() {
    setPushState("busy");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setPushState("off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const res = await fetch("/api/push");
      const { key } = await res.json();
      if (!key) {
        setPushState("off");
        return;
      }
      const sub = await subscribeWithCurrentKey(reg, key);
      const json = sub.toJSON();
      const ok = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, endpoint: json.endpoint, keys: json.keys }),
      });
      if (ok.ok) {
        localStorage.setItem(`kado-push-${slug}`, "1");
        setPushState("on");
      } else {
        setPushState("off");
      }
    } catch {
      setPushState("off");
    }
  }

  async function saveExtra(patch: {
    birthday_day?: number;
    birthday_month?: number;
    marketing_ok?: boolean;
  }) {
    try {
      const res = await fetch("/api/loyalty/extra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          email: email.trim().toLowerCase(),
          code: card?.code,
          ...patch,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function saveBirthday() {
    const d = Number(bDay);
    const m = Number(bMonth);
    if (!d || !m) return;
    setBBusy(true);
    const ok = await saveExtra({ birthday_day: d, birthday_month: m });
    setBBusy(false);
    if (ok && card) setCard({ ...card, birthdaySet: true });
  }

  async function toggleMarketing(v: boolean) {
    if (card) setCard({ ...card, marketingOk: v });
    await saveExtra({ marketing_ok: v });
  }

  /** Demande de ré-abonnement (double opt-in) : déclenche l'e-mail de confirmation. */
  async function requestResubscribe() {
    setResubState("busy");
    try {
      const res = await fetch("/api/loyalty/resubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, email: email.trim().toLowerCase() }),
      });
      // La réponse serveur est neutre (anti-énumération) : `ok` ne révèle rien
      // sur l'existence de l'e-mail. On distingue seulement un échec RÉSEAU
      // (retentable) du cas nominal, pour ne pas mentir à l'utilisateur.
      setResubState(res.ok ? "sent" : "error");
    } catch {
      setResubState("error");
    }
  }

  async function shareReferral() {
    if (!card) return;
    const url = `${window.location.origin}/${slug}/fidelite?parrain=${card.code}`;
    const text = `Rejoins la carte de fidélité de ${name} et cumule des récompenses : ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: name, text, url });
        return;
      }
    } catch {
      /* partage annulé */
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* ignore */
    }
  }

  // Pré-remplissage depuis une visite précédente
  useEffect(() => {
    const saved = localStorage.getItem(`kado-fid-${slug}`);
    if (saved) {
      setEmail(saved);
      load(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // QR du code de carte (à présenter au commerçant)
  useEffect(() => {
    let alive = true;
    if (card?.code) {
      import("qrcode")
        .then(({ default: QRCode }) =>
          QRCode.toDataURL(card.code, {
            width: 240,
            margin: 1,
            color: { dark: "#1b1035", light: "#ffffff" },
          })
        )
        .then((u) => alive && setQr(u))
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [card?.code]);

  async function load(mail: string) {
    const clean = mail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
      setErr("Entrez une adresse e-mail valide.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/loyalty/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          email: clean,
          ...(parrain ? { parrain } : {}),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) {
        setCard(d as CardData);
        setOffline(false);
        localStorage.setItem(`kado-fid-${slug}`, clean);
        // Copie locale pour un affichage hors connexion (le code ne change pas)
        try {
          localStorage.setItem(`kado-fid-card-${slug}`, JSON.stringify(d));
        } catch {
          /* stockage plein : tant pis */
        }
      } else {
        setErr(
          d.error === "loyalty_off"
            ? "La carte de fidélité n'est pas disponible ici."
            : "Impossible d'ouvrir votre carte. Réessayez."
        );
      }
    } catch {
      // Pas de réseau : on affiche la dernière carte connue (le QR reste valable)
      const cached = readCachedCard();
      if (cached) {
        setCard(cached);
        setOffline(true);
        setErr(null);
      } else {
        setErr("Connexion impossible. Réessayez.");
      }
    } finally {
      setBusy(false);
    }
  }

  function readCachedCard(): CardData | null {
    try {
      const raw = localStorage.getItem(`kado-fid-card-${slug}`);
      if (!raw) return null;
      const d = JSON.parse(raw);
      return d && d.code ? (d as CardData) : null;
    } catch {
      return null;
    }
  }

  function reset() {
    setCard(null);
    setQr(null);
    setOffline(false);
    localStorage.removeItem(`kado-fid-${slug}`);
    localStorage.removeItem(`kado-fid-card-${slug}`);
  }

  const logo = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt={name} className="logo-img" />
  ) : (
    <div className="logo">{(name || "?").charAt(0).toUpperCase()}</div>
  );

  return (
    <div className="app">
      <div className="card fid-wrap">
        <div className="brand">
          {logo}
          <div>
            <div className="name">{name}</div>
            <div className="tag">Carte de fidélité</div>
          </div>
        </div>

        <HighlightCard highlight={highlight} />

        {!card ? (
          <section className="screen active">
            <h1>
              Votre carte de <span className="accent">fidélité</span>&nbsp;🎟️
            </h1>
            <p className="sub">
              Cumulez <b>{goal} tampons</b> et gagnez&nbsp;:{" "}
              <b>
                {rewardEmoji} {reward}
              </b>
              . Entrez votre e-mail pour ouvrir votre carte — présentez-la à
              chaque visite.
            </p>
            <form
              className="fid-form"
              onSubmit={(e) => {
                e.preventDefault();
                load(email);
              }}
            >
              <input
                type="email"
                inputMode="email"
                placeholder="votre@email.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <button className="btn" type="submit" disabled={busy}>
                {busy ? "Ouverture…" : "Ouvrir ma carte →"}
              </button>
            </form>
            {err && <p className="err">{err}</p>}
            <p className="fine">
              Votre e-mail sert uniquement à retrouver votre carte de fidélité.
            </p>
          </section>
        ) : (
          <section className="screen active">
            {offline && (
              <div className="fid-offline" role="status">
                📶 Mode hors connexion — voici votre dernière carte connue.
                Votre code reste valable, les tampons se mettront à jour au
                retour du réseau.
              </div>
            )}
            {card.rewardReady && (
              <div className="fid-reward">
                <div className="fid-reward-emoji">{card.rewardEmoji}</div>
                <b>Récompense débloquée&nbsp;!</b>
                <div className="fid-reward-label">{card.reward}</div>
                <p>Montrez cette carte au commerçant pour en profiter.</p>
              </div>
            )}

            <h2 className="fid-count">
              {card.stamps} <span>/ {card.goal} tampons</span>
            </h2>
            <div className="fid-progress">
              <span
                className="fid-progress-fill"
                style={{
                  width: `${Math.min(100, (card.stamps / card.goal) * 100)}%`,
                }}
              />
            </div>
            {!card.rewardReady && card.goal - card.stamps > 0 && (
              <p className="fid-remaining">
                {card.goal - card.stamps === 1 ? (
                  <>Plus qu'<b>1 tampon</b> avant votre récompense&nbsp;! 🎉</>
                ) : (
                  <>
                    Plus que <b>{card.goal - card.stamps} tampons</b> avant votre
                    récompense.
                  </>
                )}
              </p>
            )}
            <div className="fid-stamps">
              {Array.from({ length: card.goal }).map((_, i) => (
                <span
                  key={i}
                  className={`fid-stamp${i < card.stamps ? " on" : ""}`}
                >
                  {i < card.stamps ? stampEmoji : i + 1}
                </span>
              ))}
            </div>

            <p className="sub" style={{ marginTop: 4 }}>
              Objectif&nbsp;:{" "}
              <b>
                {card.rewardEmoji} {card.reward}
              </b>
              {card.rewardsEarned > 0 && (
                <>
                  {" "}
                  · déjà gagné <b>{card.rewardsEarned}×</b> 🎉
                </>
              )}
            </p>

            <div className="fid-code-box">
              <small>À présenter au commerçant</small>
              {qr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="QR de ma carte" className="fid-qr" />
              )}
              <div className="fid-code">{card.code}</div>
            </div>

            {installHint && (
              <div className="fid-extra fid-install">
                <b>📲 Gardez votre carte à portée de main</b>
                {installHint === "android" ? (
                  <p>
                    Ajoutez-la à votre écran d'accueil : menu <b>⋮</b> de votre
                    navigateur → <b>« Ajouter à l'écran d'accueil »</b>. Votre
                    carte s'ouvrira comme une appli, en un tap.
                  </p>
                ) : (
                  <p>
                    Ajoutez-la à votre écran d'accueil : bouton <b>Partager</b>{" "}
                    (carré avec une flèche ↑) → <b>« Sur l'écran d'accueil »</b>.
                    Votre carte s'ouvrira comme une appli, en un tap.
                  </p>
                )}
                <button className="fid-install-later" onClick={dismissInstall}>
                  C'est fait / plus tard
                </button>
              </div>
            )}

            {pushState !== "unsupported" && (
              <div className="fid-extra">
                <b>🔔 Les bons plans de {name}</b>
                {pushState === "on" ? (
                  <p>
                    ✅ Notifications activées — vous recevrez les offres et
                    promos directement sur cet appareil.
                  </p>
                ) : (
                  <>
                    <p>
                      Recevez les offres et promos en notification sur votre
                      téléphone (désactivable à tout moment dans les réglages
                      du navigateur).
                    </p>
                    <button
                      className="btn"
                      onClick={enableOffersPush}
                      disabled={pushState === "busy"}
                    >
                      {pushState === "busy"
                        ? "Activation…"
                        : "Activer les notifications"}
                    </button>
                  </>
                )}
              </div>
            )}

            {card.referralEnabled && (
              <div className="fid-extra">
                <b>🤝 Invitez un ami, gagnez +1 tampon</b>
                <p>
                  Votre ami crée sa carte via votre lien, et dès son premier
                  achat en caisse, vous gagnez un tampon.
                </p>
                {(card.referralCount ?? 0) > 0 && (
                  <div className="fid-referral-count" role="status">
                    <span className="fid-referral-n">{card.referralCount}</span>
                    <span>
                      ami{(card.referralCount ?? 0) > 1 ? "s" : ""} inscrit
                      {(card.referralCount ?? 0) > 1 ? "s" : ""} grâce à vous
                      {(card.referralRewarded ?? 0) > 0 && (
                        <>
                          {" "}
                          · <b>+{card.referralRewarded} tampon
                          {(card.referralRewarded ?? 0) > 1 ? "s" : ""}</b> gagné
                          {(card.referralRewarded ?? 0) > 1 ? "s" : ""} 🎉
                        </>
                      )}
                    </span>
                  </div>
                )}
                <button className="btn" onClick={shareReferral}>
                  {copied ? "✅ Lien copié !" : "Partager mon lien"}
                </button>
              </div>
            )}

            {card.birthdayEnabled && !card.birthdaySet && (
              <div className="fid-extra">
                <b>🎂 Votre anniversaire (facultatif)</b>
                <p>Recevez une surprise le jour J.</p>
                <div className="fid-bday-row">
                  <select
                    value={bDay}
                    onChange={(e) => setBDay(e.target.value)}
                    aria-label="Jour"
                  >
                    <option value="">Jour</option>
                    {Array.from({ length: 31 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                  <select
                    value={bMonth}
                    onChange={(e) => setBMonth(e.target.value)}
                    aria-label="Mois"
                  >
                    <option value="">Mois</option>
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn"
                    onClick={saveBirthday}
                    disabled={bBusy || !bDay || !bMonth}
                  >
                    OK
                  </button>
                </div>
              </div>
            )}
            {card.birthdayEnabled && card.birthdaySet && (
              <p className="fid-bday-ok">🎂 Anniversaire enregistré — surprise le jour J !</p>
            )}

            {card.unsubscribed ? (
              <div className="fid-extra">
                <b>💌 Vous êtes désinscrit(e) des offres de {name}</b>
                {resubState === "sent" ? (
                  <p role="status">
                    📧 E-mail de confirmation envoyé — cliquez sur le lien reçu
                    pour finaliser votre ré-abonnement.
                  </p>
                ) : (
                  <>
                    <p>
                      Pour recevoir de nouveau les offres, demandez un lien de
                      confirmation par e-mail.
                    </p>
                    {resubState === "error" && (
                      <p role="alert" className="fid-err">
                        Connexion impossible. Réessayez dans un instant.
                      </p>
                    )}
                    <button
                      className="btn"
                      onClick={requestResubscribe}
                      disabled={resubState === "busy"}
                    >
                      {resubState === "busy"
                        ? "Envoi…"
                        : resubState === "error"
                          ? "Réessayer"
                          : "Me ré-abonner aux offres"}
                    </button>
                  </>
                )}
              </div>
            ) : (
              !card.marketingOk && (
                <label className="fid-consent">
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={(e) => toggleMarketing(e.target.checked)}
                  />
                  <span>Recevoir les offres de {name} par e-mail</span>
                </label>
              )
            )}

            <button className="btn-ghost-line" onClick={() => load(email || "")}>
              🔄 Actualiser
            </button>
            <button className="fid-switch" onClick={reset}>
              Utiliser une autre adresse e-mail
            </button>
          </section>
        )}
        <FeedbackForm slug={slug} enabled={feedbackEnabled} />
      </div>
      <footer className="game-footer">
        <a href={`/${slug}`}>← Retour au jeu</a>
        <span>·</span>
        <a href="/legal/confidentialite" target="_blank" rel="noopener">
          Confidentialité
        </a>
      </footer>
    </div>
  );
}
