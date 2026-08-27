/**
 * Récap hebdomadaire : comparaison d'une semaine à la précédente. Logique PURE
 * (aucune base, aucun HTML) pour rester testable.
 */

/** Une ligne de récap hebdo agrégée côté SQL (RPC `recap_weekly_stats`). */
export type RecapRow = {
  business_id: string;
  tours: number;
  gagnes: number;
  echanges: number;
  emails: number;
  fid: number;
  prev_tours: number;
  prev_emails: number;
  prev_fid: number;
};

/** Normalise la sortie JSON de la RPC `recap_weekly_stats` en lignes typées. */
export function parseRecapRows(data: unknown): RecapRow[] {
  if (!Array.isArray(data)) return [];
  const n = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
  const out: RecapRow[] = [];
  for (const r of data) {
    if (!r || typeof r !== "object") continue;
    const row = r as Record<string, unknown>;
    if (row.business_id == null) continue;
    out.push({
      business_id: String(row.business_id),
      tours: n(row.tours),
      gagnes: n(row.gagnes),
      echanges: n(row.echanges),
      emails: n(row.emails),
      fid: n(row.fid),
      prev_tours: n(row.prev_tours),
      prev_emails: n(row.prev_emails),
      prev_fid: n(row.prev_fid),
    });
  }
  return out;
}

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
