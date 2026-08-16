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
};

export default function LoyaltyCard({
  slug,
  name,
  logoUrl,
  goal,
  reward,
  rewardEmoji,
}: {
  slug: string;
  name: string;
  logoUrl: string | null;
  goal: number;
  reward: string;
  rewardEmoji: string;
}) {
  const [email, setEmail] = useState("");
  const [card, setCard] = useState<CardData | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);

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
        body: JSON.stringify({ slug, email: clean }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) {
        setCard(d as CardData);
        localStorage.setItem(`kado-fid-${slug}`, clean);
      } else {
        setErr(
          d.error === "loyalty_off"
            ? "La carte de fidélité n'est pas disponible ici."
            : "Impossible d'ouvrir votre carte. Réessayez."
        );
      }
    } catch {
      setErr("Connexion impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setCard(null);
    setQr(null);
    localStorage.removeItem(`kado-fid-${slug}`);
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
            <div className="fid-stamps">
              {Array.from({ length: card.goal }).map((_, i) => (
                <span
                  key={i}
                  className={`fid-stamp${i < card.stamps ? " on" : ""}`}
                >
                  {i < card.stamps ? "🎁" : i + 1}
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
