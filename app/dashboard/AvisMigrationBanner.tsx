"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Bannière d'information (Story 9.4) : l'avis Google ne débloque plus de tour
 * (conformité). Affichée uniquement aux commerçants concernés — la décision est
 * prise côté serveur via `avisMigrationNoticeNeeded` avant de monter ce composant.
 *
 * Fermeture (dismiss) persistée *par navigateur* via `localStorage`, le tout
 * enveloppé dans try/catch : jamais d'exception si le stockage est indisponible.
 * La clé est **namespacée par établissement** (`businessId`) : sur un navigateur
 * partagé / multi-compte, fermer pour un commerçant ne masque pas les autres.
 * État initial masqué tant que le `localStorage` n'est pas lu (évite le flash),
 * lecture effectuée dans `useEffect`.
 */
export default function AvisMigrationBanner({
  businessId,
}: {
  businessId: string;
}) {
  const [visible, setVisible] = useState(false);
  const dismissKey = `kado_avis_notice_dismissed_${businessId}`;

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(dismissKey) === "1";
    } catch {
      /* stockage indisponible : on affiche la bannière */
    }
    if (!dismissed) setVisible(true);
  }, [dismissKey]);

  if (!visible) return null;

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(dismissKey, "1");
    } catch {
      /* stockage indisponible : fermeture non persistée, sans erreur */
    }
  }

  return (
    <div className="dash-notice" role="region" aria-label="Information conformité avis">
      <div className="dash-notice-txt">
        <b>L'avis Google ne débloque plus de tour (conformité).</b> Vérifiez vos
        actions déclenchantes.
      </div>
      <div className="dash-notice-actions">
        <Link href="/dashboard/wheel" className="dash-notice-cta">
          Vérifier mes actions <span aria-hidden="true">→</span>
        </Link>
        <button
          type="button"
          className="dash-notice-close"
          aria-label="Fermer"
          onClick={dismiss}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
