/**
 * Estimation du temps d'attente au comptoir (bipeur) — logique PURE.
 *
 * On mesure le temps de préparation récent (de la création à « prêt ») et on
 * l'extrapole à la position du client dans la file. Volontairement prudent et
 * approximatif : affiché comme « ~X min ».
 */

export type PrepSample = {
  created_at?: string | null;
  notified_ready_at?: string | null;
};

const TWO_HOURS_MS = 2 * 3600 * 1000;
const MIN_SAMPLES = 3;

/**
 * Temps de préparation MÉDIAN (ms) sur des commandes récentes, robuste aux
 * extrêmes. Ignore les durées nulles/négatives/aberrantes (> 2 h). Renvoie null
 * si trop peu d'échantillons fiables (< 3).
 */
export function averagePrepMs(samples: PrepSample[]): number | null {
  const durs: number[] = [];
  for (const s of samples) {
    if (!s.created_at || !s.notified_ready_at) continue;
    const d = Date.parse(s.notified_ready_at) - Date.parse(s.created_at);
    if (Number.isFinite(d) && d > 0 && d <= TWO_HOURS_MS) durs.push(d);
  }
  if (durs.length < MIN_SAMPLES) return null;
  durs.sort((a, b) => a - b);
  const mid = Math.floor(durs.length / 2);
  return durs.length % 2 ? durs[mid] : (durs[mid - 1] + durs[mid]) / 2;
}

/** Arrondi « lisible » : à la minute jusqu'à 5, puis au multiple de 5. */
export function friendlyMinutes(min: number): number {
  if (min <= 5) return Math.max(1, min);
  return Math.round(min / 5) * 5;
}

/**
 * Attente estimée (minutes) pour un client ayant `ahead` commandes devant lui.
 * Sa propre préparation compte aussi (d'où `ahead + 1`). null si pas de base.
 */
export function estimateWaitMinutes(
  avgPrepMs: number | null,
  ahead: number
): number | null {
  if (avgPrepMs == null || avgPrepMs <= 0) return null;
  const totalMin = (avgPrepMs * (ahead + 1)) / 60000;
  return friendlyMinutes(Math.round(totalMin));
}
