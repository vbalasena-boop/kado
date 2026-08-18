"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Page d'erreur globale : remplace la mise en page racine si une erreur
// non gérée survient. Remonte l'erreur à Sentry (inerte sans DSN) et affiche
// un écran propre au lieu de l'erreur brute de Next.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "radial-gradient(120% 100% at 50% 0%, #2a1a52, #150c29)",
          color: "#fdf4e3",
          fontFamily:
            '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif',
          padding: 24,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎡</div>
          <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>
            Oups, un petit souci
          </h1>
          <p style={{ color: "rgba(253,244,227,.75)", lineHeight: 1.5, margin: "0 0 20px" }}>
            Une erreur inattendue s&apos;est produite. Réessayez dans un instant.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: "linear-gradient(180deg,#ffc24d,#f0a52e)",
              color: "#1b1035",
              fontWeight: 800,
              border: "none",
              borderRadius: 999,
              padding: "11px 22px",
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
