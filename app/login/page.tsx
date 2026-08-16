"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const isSignup = params.get("signup") === "1";

  // Lien de parrainage commerçant (?p=slug) : mémorisé jusqu'à l'inscription
  useEffect(() => {
    const p = params.get("p");
    if (p) {
      try {
        localStorage.setItem("kado-parrain", p);
      } catch {
        /* ignore */
      }
    }
  }, [params]);

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
        <div className="auth-logo">{isSignup ? "🎁" : "🎡"}</div>
        <h1 style={{ textAlign: "center" }}>
          {isSignup ? "Créer mon compte" : "Espace commerçant"}
        </h1>

        {isSignup && step === "email" && (
          <div className="auth-signup-perks">
            <span>✓ 14 jours d'essai gratuit</span>
            <span>✓ Sans carte bancaire</span>
            <span>✓ Sans engagement</span>
          </div>
        )}

        {step === "email" ? (
          <form onSubmit={sendCode} className="auth-form">
            <p>
              {isSignup ? (
                <>
                  Entrez votre e-mail pour créer votre compte : vous recevrez un{" "}
                  <b>code à 6 chiffres</b> (sans mot de passe). Votre espace est
                  créé en 2 minutes.
                </>
              ) : (
                <>
                  Entrez votre e-mail : vous recevrez un <b>code à 6 chiffres</b>{" "}
                  pour vous connecter (sans mot de passe).
                </>
              )}
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
              {loading
                ? "Envoi…"
                : isSignup
                ? "Créer mon compte gratuit"
                : "Recevoir mon code"}
            </button>
            <p className="auth-switch">
              {isSignup ? (
                <>
                  Vous avez déjà un compte ?{" "}
                  <a href="/login">Se connecter</a>
                </>
              ) : (
                <>
                  Pas encore de compte ?{" "}
                  <a href="/login?signup=1">Créer mon compte gratuit</a>
                </>
              )}
            </p>
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
              {loading ? "Vérification…" : isSignup ? "Créer mon compte" : "Se connecter"}
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

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="auth-page" />}>
      <LoginInner />
    </Suspense>
  );
}
