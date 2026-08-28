/**
 * Fonctions optionnelles activables au cas par cas sur UN établissement.
 *
 * Le champ `businesses.features` est un objet JSON `{ clef: true }`. Il permet
 * d'activer/personnaliser des fonctions sur un seul commerce, sans toucher aux
 * autres et sans migration à chaque nouvelle option. Logique pure (testée) :
 * l'admin écrit ces drapeaux, le reste de l'app lit `hasFeature`.
 */

export type FeatureFlags = Record<string, boolean>;

/** Catalogue des fonctions optionnelles connues (affichées dans l'admin). */
export const OPTIONAL_FEATURES: {
  key: string;
  label: string;
  desc: string;
}[] = [
  {
    key: "priority_support",
    label: "Support prioritaire",
    desc: "Marque l'établissement comme prioritaire (traité avant les autres).",
  },
  {
    key: "beta",
    label: "Accès bêta",
    desc: "Donne accès aux nouvelles fonctions en avant-première.",
  },
  {
    key: "hide_branding",
    label: "Masquer « propulsé par Kado »",
    desc: "Retire la mention Kado en bas de la page de jeu (marque blanche).",
  },
];

/** Clefs autorisées (celles du catalogue). */
const ALLOWED = new Set(OPTIONAL_FEATURES.map((f) => f.key));

/**
 * Une fonction est-elle active pour cet établissement ?
 * Tolérant : `features` peut être absent/null/mal formé → false.
 */
export function hasFeature(
  features: FeatureFlags | null | undefined,
  key: string
): boolean {
  if (!features || typeof features !== "object") return false;
  return features[key] === true;
}

/**
 * Nettoie un objet de drapeaux venant de l'extérieur :
 *   - ne garde que les clefs CONNUES (catalogue) ;
 *   - ne garde que les valeurs booléennes `true` (les `false`/autres sont
 *     retirés → l'objet ne contient que ce qui est réellement activé).
 * Entrée invalide (null, tableau, non-objet) → `{}`.
 */
export function normalizeFeatures(input: unknown): FeatureFlags {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: FeatureFlags = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (ALLOWED.has(k) && v === true) out[k] = true;
  }
  return out;
}
