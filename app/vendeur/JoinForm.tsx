"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Formulaire « Devenir promoteur » (utilisateur déjà connecté). */
export default function JoinForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/vendeur/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === "code_taken"
            ? "Ce code est déjà pris — choisissez-en un autre."
            : data.error === "name_required"
              ? "Indiquez votre nom."
              : "Inscription impossible pour le moment. Réessayez."
        );
      } else {
        router.refresh();
      }
    } catch {
      setError("Erreur réseau — réessayez.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={join} className="admin-create">
      <input
        type="text"
        required
        placeholder="Votre nom (ex. Paul Martin)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        type="text"
        placeholder="Code souhaité pour votre lien (ex. paul)"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <button className="btn" disabled={busy}>
        {busy ? "Envoi…" : "Envoyer ma candidature"}
      </button>
      {error && <p className="err">{error}</p>}
    </form>
  );
}
