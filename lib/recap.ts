/**
 * Récap hebdomadaire : comparaison d'une semaine à la précédente. Logique PURE
 * (aucune base, aucun HTML) pour rester testable.
 */

export type RecapDelta = {
  pct: number | null; // variation %, null si la semaine précédente = 0
  dir: "up" | "down" | "flat";
};

/** Variation d'un indicateur d'une semaine à l'autre (arrondie). */
export function recapDelta(current: number, previous: number): RecapDelta {
  if (previous <= 0) {
    // Pas de base de comparaison fiable → on n'affiche pas de pourcentage.
    return { pct: null, dir: current > 0 ? "up" : "flat" };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  return { pct, dir: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
}

/**
 * Fragment texte « ▲ +20 % » / « ▼ -10 % » / « = » pour un indicateur, ou null
 * si non pertinent (première semaine, ou aucune activité des deux côtés).
 */
export function recapDeltaLabel(current: number, previous: number): string | null {
  const d = recapDelta(current, previous);
  if (d.pct === null) {
    // Nouvelle activité sans base précédente : mention discrète « nouveau ».
    return current > 0 && previous === 0 ? "nouveau" : null;
  }
  if (d.dir === "flat") return "=";
  const sign = d.dir === "up" ? "▲ +" : "▼ ";
  return `${sign}${d.pct} %`;
}
