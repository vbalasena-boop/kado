"use client";

import { useEffect, useState } from "react";

type CardData = {
  code: string;
  stamps: number;
  goal: number;
  rewardsEarned: number;
  rewardReady: boolean;
  rewardCode: string | null;
  reward: string;
  rewardEmoji: string;
  birthdayEnabled?: boolean;
  referralEnabled?: boolean;
  birthdaySet?: boolean;
  marketingOk?: boolean;
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
}: {
  slug: string;
  name: string;
  logoUrl: string | null;
  goal: number;
  reward: string;
  rewardEmoji: string;
  stampEmoji?: string;
  parrain?: string | null;
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

  async function saveExtra(patch: {
    birthday_day?: number;
    birthday_month?: number;
    marketing_ok?: boolean;
  }) {
    try {
      const res = await fetch("/api/loyalty/extra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, email: email.trim().toLowerCase(), ...patch }),
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

            {card.referralEnabled && (
              <div className="fid-extra">
                <b>🤝 Invitez un ami, gagnez +1 tampon</b>
                <p>
                  Votre ami crée sa carte via votre lien, et dès son premier
                  achat en caisse, vous gagnez un tampon.
                </p>
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

            {!card.marketingOk && (
              <label className="fid-consent">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={(e) => toggleMarketing(e.target.checked)}
                />
                <span>Recevoir les offres de {name} par e-mail</span>
              </label>
            )}

            <button className="btn-ghost-line" onClick={() => load(email || "")}>
              🔄 Actualiser
            </button>
            <button className="fid-switch" onClick={reset}>
              Utiliser une autre adresse e-mail
            </button>
          </section>
        )}
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
