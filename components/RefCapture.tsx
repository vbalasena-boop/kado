"use client";

import { useEffect } from "react";

/**
 * Capture deux attributions sur n'importe quelle page publique :
 *  - `?ref=paul`  → cookie `kado-aff` (vendeur/affilié), 90 j, dernier lien gagne.
 *  - `?parrain=cafe-lumiere` → cookie `kado-parrain` (parrainage commerçant),
 *    30 j, PREMIER lien gagne (on n'écrase pas un parrain déjà mémorisé).
 * L'inscription (API onboarding) lit ces cookies pour attribuer le client.
 */
export default function RefCapture() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);

      // Affilié / vendeur — dernier lien cliqué gagne.
      const ref = params.get("ref");
      if (ref) {
        const clean = ref.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
        if (clean && clean.length <= 40) {
          document.cookie = `kado-aff=${clean}; path=/; max-age=${90 * 86400}; samesite=lax`;
        }
      }

      // Parrainage commerçant — premier parrain mémorisé gagne.
      const parrain = params.get("parrain");
      if (parrain && !/(?:^|; )kado-parrain=/.test(document.cookie)) {
        const cleanP = parrain.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
        if (cleanP && cleanP.length <= 60) {
          document.cookie = `kado-parrain=${cleanP}; path=/; max-age=${30 * 86400}; samesite=lax`;
        }
      }
    } catch {
      /* décoratif : ne doit jamais casser une page */
    }
  }, []);
  return null;
}
