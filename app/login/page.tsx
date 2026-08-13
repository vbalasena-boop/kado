"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) setError(error.message);
      else setSent(true);
    } catch {
      setError("La connexion n'est pas configurée (clés Supabase manquantes).");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="landing">
      <div className="landing-card" style={{ textAlign: "left" }}>
        <div className="landing-logo" style={{ textAlign: "center" }}>
          🎡
        </div>
        <h1 style={{ textAlign: "center" }}>Espace commerçant</h1>
        {sent ? (
          <p style={{ textAlign: "center" }}>
            📩 Lien de connexion envoyé à <b>{email}</b>. Ouvrez votre boîte mail
            et cliquez sur le lien pour accéder à votre tableau de bord.
          </p>
        ) : (
          <form onSubmit={submit} className="auth-form">
            <p>
              Entrez votre e-mail : vous recevrez un lien de connexion (sans mot
              de passe).
            </p>
            <input
              type="email"
              required
              placeholder="vous@commerce.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
            />
            {error && <p className="err">{error}</p>}
            <button className="btn" disabled={loading}>
              {loading ? "Envoi…" : "Recevoir mon lien"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
