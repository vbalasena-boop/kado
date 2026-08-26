import { labelIsLosing } from "@/lib/draw";

/**
 * Agrégats de la console admin (statistiques plateforme + nombre de tours par
 * commerce). La page /admin scannait TOUTES les lignes `plays` de TOUS les
 * commerces pour les agréger en JS — la requête la plus lourde de l'app, qui
 * grossit sans borne. On délègue à Postgres (RPC 0053), ces fonctions pures
 * servant de REPLI à l'identique si la migration n'est pas encore appliquée.
 */

export type AdminPlayRow = {
  business_id?: string | null;
  play_type?: string | null;
  prize_label?: string | null;
  redeemed_at?: string | null;
  created_at?: string | null;
};

export type AdminPlayStats = {
  playsTotal: number;
  playsMonth: number;
  playsToday: number;
  insta: number;
  review: number;
  won: number;
  redeemed: number;
};

/**
 * Agrégation JS de repli — logique HISTORIQUE conservée à l'identique :
 * `won` s'appuie sur `labelIsLosing` (libellé), les bornes mois/jour comparent
 * les instants ISO.
 */
export function computeAdminPlayStats(
  rows: AdminPlayRow[],
  monthStartIso: string,
  dayStartIso: string
): AdminPlayStats {
  const monthStart = Date.parse(monthStartIso);
  const dayStart = Date.parse(dayStartIso);
  let playsMonth = 0;
  let playsToday = 0;
  let insta = 0;
  let review = 0;
  let won = 0;
  let redeemed = 0;
  for (const r of rows) {
    const t = r.created_at ? Date.parse(r.created_at) : NaN;
    if (!Number.isNaN(t)) {
      if (t >= monthStart) playsMonth++;
      if (t >= dayStart) playsToday++;
    }
    if (r.play_type === "instagram") insta++;
    if (r.play_type === "review") review++;
    if (!labelIsLosing(r.prize_label)) won++;
    if (r.redeemed_at) redeemed++;
  }
  return {
    playsTotal: rows.length,
    playsMonth,
    playsToday,
    insta,
    review,
    won,
    redeemed,
  };
}

/** Nombre de tours par commerce (clé = business_id). */
export function computeBusinessPlayCounts(
  rows: AdminPlayRow[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.business_id)
      counts.set(r.business_id, (counts.get(r.business_id) ?? 0) + 1);
  }
  return counts;
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

/** Normalise la sortie JSON de la RPC `admin_play_stats`. */
export function adminPlayStatsFromRpc(data: unknown): AdminPlayStats | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  return {
    playsTotal: num(d.playsTotal),
    playsMonth: num(d.playsMonth),
    playsToday: num(d.playsToday),
    insta: num(d.insta),
    review: num(d.review),
    won: num(d.won),
    redeemed: num(d.redeemed),
  };
}

/** Normalise la sortie JSON de `admin_business_play_counts` (array de [id, n]). */
export function businessPlayCountsFromRpc(
  data: unknown
): Map<string, number> | null {
  if (!Array.isArray(data)) return null;
  const counts = new Map<string, number>();
  for (const item of data) {
    if (Array.isArray(item) && item.length >= 2 && item[0] != null) {
      counts.set(String(item[0]), num(item[1]));
    }
  }
  return counts;
}
