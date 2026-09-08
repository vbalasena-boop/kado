"use client";

import { useEffect } from "react";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="landing">
      <div className="landing-card">
        <div className="landing-logo"><WarningCircle size={54} weight="duotone" color="var(--coral)" /></div>
        <h1>Une erreur est survenue</h1>
        <p>
          Désolé, quelque chose s'est mal passé. Réessayez dans un instant. Si
          le problème persiste, revenez un peu plus tard.
        </p>
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            marginTop: 18,
            flexWrap: "wrap",
          }}
        >
          <button className="v-btn primary" onClick={() => reset()}>
            Réessayer
          </button>
          <a className="v-btn ghost" href="/">
            Accueil
          </a>
        </div>
      </div>
    </main>
  );
}
