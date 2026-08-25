// Logique pure pour l'étape « laissez votre e-mail » des actions Offres
// (`optin`) et Fidélité (`loyalty`), et pour l'auto-envoi du code après une
// victoire. Aucune dépendance réseau ni React : testable en isolation.

/** Validation e-mail simple (trim + regex). `true` seulement si l'adresse
 *  triée ressemble à `local@domaine.tld`. */
export function isValidEmail(email: string | null | undefined): boolean {
  const e = (email ?? "").trim();
  if (!e || e.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/** Actions déclenchantes qui passent par l'étape « laissez votre e-mail »
 *  (facultative) avant de débloquer le tour : Offres et Fidélité. Instagram
 *  garde son ouverture de lien. */
export function needsCollectStep(kind: unknown): boolean {
  return kind === "optin" || kind === "loyalty";
}

/** Décide vers quelle adresse auto-envoyer le code après un tour.
 *  Renvoie l'e-mail capté uniquement si :
 *   - un e-mail valide a été capté, ET
 *   - le tour est gagnant (`isWin`), ET
 *   - un code exploitable existe.
 *  Sinon `null` (aucun envoi automatique). */
export function autoSendCodeTarget({
  capturedEmail,
  code,
  isWin,
}: {
  capturedEmail: string | null | undefined;
  code: string | null | undefined;
  isWin: boolean;
}): string | null {
  if (!isWin) return null;
  if (!code || !code.trim()) return null;
  if (!isValidEmail(capturedEmail)) return null;
  return (capturedEmail as string).trim();
}
