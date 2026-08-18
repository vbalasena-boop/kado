"use client";

import { useEffect } from "react";

/**
 * Capture le code vendeur (?ref=paul) sur n'importe quelle page publique et
 * le mémorise 90 jours. L'inscription (API onboarding) lira ce cookie pour
 * attribuer le client au vendeur. Dernier lien cliqué = vendeur crédité.
 */
export default function RefCapture() {
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (!ref) return;
      const clean = ref.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
      if (!clean || clean.length > 40) return;
      document.cookie = `kado-aff=${clean}; path=/; max-age=${90 * 86400}; samesite=lax`;
    } catch {
      /* décoratif : ne doit jamais casser une page */
    }
  }, []);
  return null;
}
