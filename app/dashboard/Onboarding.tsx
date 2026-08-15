"use client";

import { useState } from "react";

export function Onboarding() {
  const [name, setName] = useState("");
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
        body: JSON.stringify({ name: n }),
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
      <h2>Bienvenue sur Kado&nbsp;! 🎉</h2>
      <p className="onboarding-lead">
        Créez votre établissement pour démarrer votre <b>essai gratuit de 14
        jours</b>. Vous pourrez tout personnaliser ensuite.
      </p>
      <label htmlFor="biz-name">Nom de votre commerce</label>
      <input
        id="biz-name"
        className="onboarding-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ex. Café Lumière"
        maxLength={60}
        autoFocus
      />
      {err && <p className="onboarding-err">{err}</p>}
      <button className="btn" type="submit" disabled={busy || !name.trim()}>
        {busy ? "Création…" : "Créer mon espace →"}
      </button>
      <p className="onboarding-note">
        Sans engagement · aucune carte bancaire requise pour l'essai.
      </p>
    </form>
  );
}
