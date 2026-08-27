/**
 * Tendance d'activité du tableau de bord. Logique PURE (séries + comparaison
 * mensuelle) à partir des comptes par jour renvoyés par la RPC
 * `dashboard_play_trend`. Testable sans base.
 */

export type DayCount = { date: string; count: number };

/** Décale une date ISO (AAAA-MM-JJ) de `n` jours. */
function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Parse la sortie RPC ([[jour, n], …]) en Map jour→nombre. */
export function parseTrendRpc(data: unknown): Map<string, number> {
  const m = new Map<string, number>();
  if (!Array.isArray(data)) return m;
  for (const item of data) {
    if (Array.isArray(item) && item.length >= 2 && item[0] != null) {
      const day = String(item[0]).slice(0, 10);
      const n = typeof item[1] === "number" ? item[1] : Number(item[1]) || 0;
      m.set(day, n);
    }
  }
  return m;
}

/**
 * Série continue de `days` jours se terminant à `endIso` (inclus), les jours
 * sans tour complétés à 0 — pour un axe régulier sans trous.
 */
export function fillDailySeries(
  counts: Map<string, number>,
  endIso: string,
  days: number
): DayCount[] {
  const out: DayCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(endIso, -i);
    out.push({ date, count: counts.get(date) ?? 0 });
  }
  return out;
}

/** Agrège des comptes journaliers (AAAA-MM-JJ) en comptes mensuels (AAAA-MM). */
export function aggregateByMonth(
  counts: Map<string, number>
): Map<string, number> {
  const m = new Map<string, number>();
  for (const [day, n] of counts) {
    const month = day.slice(0, 7);
    m.set(month, (m.get(month) ?? 0) + n);
  }
  return m;
}

/** Décale un mois ISO (AAAA-MM) de `n` mois. */
function addMonths(isoMonth: string, n: number): string {
  const d = new Date(isoMonth + "-01T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}

/**
 * Série mensuelle continue de `months` mois se terminant à `endMonthIso`
 * (AAAA-MM, inclus), les mois sans donnée complétés à 0. Les clés restent au
 * format AAAA-MM (compatible avec un formateur mensuel de TrendChart).
 */
export function fillMonthlySeries(
  monthCounts: Map<string, number>,
  endMonthIso: string,
  months: number
): DayCount[] {
  const out: DayCount[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const date = addMonths(endMonthIso, -i);
    out.push({ date, count: monthCounts.get(date) ?? 0 });
  }
  return out;
}

export type MonthCompare = {
  current: number; // ce mois, du 1er à aujourd'hui
  previous: number; // mois précédent, du 1er au MÊME quantième
  deltaPct: number | null; // variation %, null si le mois précédent = 0
};

/**
 * Compare le mois en cours au mois précédent, à PÉRIODE ÉGALE (1 → même
 * quantième), pour éviter un faux « -40 % » dû à un mois pas terminé.
 */
export function monthToDateComparison(
  counts: Map<string, number>,
  todayIso: string
): MonthCompare {
  const day = Number(todayIso.slice(8, 10)); // quantième du jour
  const curMonth = todayIso.slice(0, 7); // AAAA-MM

  // Mois précédent (AAAA-MM).
  const first = new Date(todayIso.slice(0, 7) + "-01T00:00:00Z");
  first.setUTCMonth(first.getUTCMonth() - 1);
  const prevMonth = first.toISOString().slice(0, 7);

  let current = 0;
  let previous = 0;
  for (const [d, n] of counts) {
    const dd = Number(d.slice(8, 10));
    if (dd > day) continue; // au-delà du quantième courant → hors comparaison
    if (d.slice(0, 7) === curMonth) current += n;
    else if (d.slice(0, 7) === prevMonth) previous += n;
  }
  const deltaPct =
    previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
  return { current, previous, deltaPct };
}
