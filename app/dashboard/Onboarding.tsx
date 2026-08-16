"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/categories";

const PLANS = [
  {
    id: "roue",
    emoji: "🎡",
    label: "Roue",
    price: "29",
    desc: "Roue de la fortune, avis Google & Instagram",
  },
  {
    id: "fidelite",
    emoji: "🎟️",
    label: "Fidélité",
    price: "19",
    desc: "Carte à tampons digitale",
  },
  {
    id: "complet",
    emoji: "⭐",
    label: "Complet",
    price: "44",
    desc: "Roue + fidélité — le meilleur tarif",
    recommended: true,
  },
];

export function Onboarding() {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("autre");
  const [plan, setPlan] = useState("complet");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n, category, plan }),
      });
      if (res.ok) {
        window.location.href = "/dashboard";
        return;
      }
      setErr("La création a échoué. Réessayez dans un instant.");
    } catch {
      setErr("Connexion impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="dash-card onboarding">
      <h2>Bienvenue sur Kado&nbsp;!</h2>
      <p className="onboarding-lead">
        Créez votre établissement pour démarrer votre <b>essai gratuit de 14
        jours</b> (toutes fonctionnalités incluses). Vous choisirez votre
        formule au moment de vous abonner.
      </p>

      <label>Type de commerce</label>
      <div className="cat-grid">
        {CATEGORIES.map((c) => (
          <button
            type="button"
            key={c.id}
            className={`cat-chip${category === c.id ? " on" : ""}`}
            onClick={() => setCategory(c.id)}
            aria-pressed={category === c.id}
          >
            <span className="cat-emoji">{c.emoji}</span>
            <span className="cat-label">{c.label}</span>
          </button>
        ))}
      </div>

      <label htmlFor="biz-name">Nom de votre commerce</label>
      <input
        id="biz-name"
        className="onboarding-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ex. Salon Éléonore"
        maxLength={60}
      />

      <label style={{ marginTop: 16 }}>Formule souhaitée (modifiable plus tard)</label>
      <div className="plan-grid">
        {PLANS.map((p) => (
          <button
            type="button"
            key={p.id}
            className={`plan-chip${plan === p.id ? " on" : ""}${p.recommended ? " recommended" : ""}`}
            onClick={() => setPlan(p.id)}
            aria-pressed={plan === p.id}
          >
            <span className="plan-emoji">{p.emoji}</span>
            <b className="plan-name">{p.label}</b>
            <span className="plan-price">{p.price}&nbsp;&euro;/mois</span>
            <small className="plan-desc">{p.desc}</small>
            {p.recommended && <span className="plan-badge">Recommandé</span>}
          </button>
        ))}
      </div>

      {err && <p className="onboarding-err">{err}</p>}
      <button className="btn" type="submit" disabled={busy || !name.trim()}>
        {busy ? "Création…" : "Créer mon espace →"}
      </button>
      <p className="onboarding-note">
        Sans engagement &middot; aucune carte bancaire requise pour l'essai.
        Pendant 14 jours vous avez accès à <b>toutes</b> les fonctionnalités.
      </p>
    </form>
  );
}
