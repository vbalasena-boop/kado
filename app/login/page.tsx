"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      });
      if (error) setError(error.message);
      else setStep("code");
    } catch {
      setError("La connexion n'est pas configurée (clés Supabase manquantes).");
    } finally {
      setLoading(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (error) {
        setError("Code invalide ou expiré. Réessayez.");
      } else {
        router.refresh();
        router.push("/dashboard");
      }
    } catch {
      setError("Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">🎡</div>
        <h1 style={{ textAlign: "center" }}>Espace commerçant</h1>

        {step === "email" ? (
          <form onSubmit={sendCode} className="auth-form">
            <p>
              Entrez votre e-mail : vous recevrez un <b>code à 6 chiffres</b> pour
              vous connecter (sans mot de passe).
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
              {loading ? "Envoi…" : "Recevoir mon code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="auth-form">
            <p>
              Un <b>code à 6 chiffres</b> a été envoyé à <b>{email}</b>. Entrez-le
              ci-dessous <i>(pensez à vérifier les spams)</i>.
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="auth-input"
              style={{ letterSpacing: "0.3em", textAlign: "center", fontSize: "22px" }}
            />
            {error && <p className="err">{error}</p>}
            <button className="btn" disabled={loading}>
              {loading ? "Vérification…" : "Se connecter"}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
            >
              ← Changer d'e-mail
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
