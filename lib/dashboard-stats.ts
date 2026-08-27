import { labelIsLosing } from "@/lib/draw";

/**
 * Agrégats du tableau de bord commerçant.
 *
 * Historiquement, la page `/dashboard` récupérait TOUTES les lignes `plays`
 * (et `loyalty_cards`) du commerce pour les agréger en JS — un scan complet à
 * chaque affichage. On délègue désormais l'agrégation à Postgres (RPC
 * `dashboard_play_stats` / `dashboard_loyalty_stats`, migration 0051), et ces
 * fonctions pures servent de REPLI si la migration n'est pas encore appliquée :
 * elles reproduisent à l'identique les chiffres affichés.
 */

export type PlayStatRow = {
  play_type?: string | null;
  prize_label?: string | null;
  created_at?: string | null;
  redeemed_at?: string | null;
};

export type PlayStats = {
  total: number;
  insta: number;
  review: number;
  last30: number;
  won: number;
  redeemed: number;
  redemptionRate: number;
  /** [libellé, nombre], du plus fréquent au moins fréquent. */
  distribution: [string, number][];
};

/** Taux de récupération en caisse (récupérés / gagnés), arrondi, borné. */
export function redemptionRateOf(won: number, redeemed: number): number {
  return won > 0 ? Math.round((redeemed / won) * 100) : 0;
}

/**
 * Complète des compteurs bruts (issus de la RPC SQL ou du repli) avec le taux
 * de récupération et une distribution triée déterministe.
 */
export function finalizePlayStats(raw: {
  total: number;
  insta: number;
  review: number;
  last30: number;
  won: number;
  redeemed: number;
  distribution: [string, number][];
}): PlayStats {
  const distribution = [...raw.distribution].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );
  return {
    total: raw.total,
    insta: raw.insta,
    review: raw.review,
    last30: raw.last30,
    won: raw.won,
    redeemed: raw.redeemed,
    redemptionRate: redemptionRateOf(raw.won, raw.redeemed),
    distribution,
  };
}

/**
 * Agrégation JS de repli — logique HISTORIQUE conservée à l'identique :
 *  - `won` s'appuie sur `labelIsLosing` (libellé), PAS sur le drapeau
 *    `is_losing`, pour ne pas modifier le chiffre déjà affiché ;
 *  - `last30` compare les ISO strings (ordre lexicographique = ordre temporel) ;
 *  - la distribution ignore les libellés vides.
 */
export function computePlayStats(
  rows: PlayStatRow[],
  sinceIso: string
): PlayStats {
  let insta = 0;
  let review = 0;
  let last30 = 0;
  let won = 0;
  let redeemed = 0;
  const dist = new Map<string, number>();
  for (const r of rows) {
    if (r.play_type === "instagram") insta++;
    if (r.play_type === "review") review++;
    if (r.created_at && r.created_at >= sinceIso) last30++;
    if (!labelIsLosing(r.prize_label)) won++;
    if (r.redeemed_at) redeemed++;
    if (r.prize_label) dist.set(r.prize_label, (dist.get(r.prize_label) ?? 0) + 1);
  }
  return finalizePlayStats({
    total: rows.length,
    insta,
    review,
    last30,
    won,
    redeemed,
    distribution: [...dist.entries()],
  });
}

export type LoyaltyStatRow = {
  stamps?: number | null;
  rewards_earned?: number | null;
};

export type LoyaltyStats = { cards: number; stamps: number; rewards: number };

/**
 * Taux de remise des récompenses fidélité.
 *
 * Chaque carte ne porte qu'UNE récompense en attente à la fois (il faut la
 * remettre avant d'en débloquer une nouvelle) : les récompenses remises valent
 * donc « total débloqué − en attente », sans avoir besoin d'historiser chaque
 * remise. Rétroactif et exact sur les données existantes.
 */
export function loyaltyRewardRate(
  rewards: number,
  pending: number
): { redeemed: number; rate: number } {
  const redeemed = Math.max(0, rewards - pending);
  return {
    redeemed,
    rate: rewards > 0 ? Math.round((redeemed / rewards) * 100) : 0,
  };
}

/** Agrégation JS de repli des stats fidélité (compte + sommes). */
export function computeLoyaltyStats(rows: LoyaltyStatRow[]): LoyaltyStats {
  return {
    cards: rows.length,
    stamps: rows.reduce((s, r) => s + (r.stamps || 0), 0),
    rewards: rows.reduce((s, r) => s + (r.rewards_earned || 0), 0),
  };
}

/** Normalise la sortie JSON de la RPC `dashboard_play_stats` en `PlayStats`. */
export function playStatsFromRpc(data: unknown): PlayStats | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
  const rawDist = Array.isArray(d.distribution) ? d.distribution : [];
  const distribution: [string, number][] = [];
  for (const item of rawDist) {
    if (Array.isArray(item) && item.length >= 2 && item[0] != null) {
      distribution.push([String(item[0]), n(item[1])]);
    }
  }
  return finalizePlayStats({
    total: n(d.total),
    insta: n(d.insta),
    review: n(d.review),
    last30: n(d.last30),
    won: n(d.won),
    redeemed: n(d.redeemed),
    distribution,
  });
}

/** Normalise la sortie JSON de la RPC `dashboard_loyalty_stats`. */
export function loyaltyStatsFromRpc(data: unknown): LoyaltyStats | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
  return { cards: n(d.cards), stamps: n(d.stamps), rewards: n(d.rewards) };
}
