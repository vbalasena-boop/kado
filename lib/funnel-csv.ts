/**
 * Export CSV « Parcours client » — une ligne par JOUR : scans, tours joués,
 * dont via Instagram, clics vers les avis Google. Pur/testable ; la route
 * d'export récupère les dates côté serveur et délègue ici le bucketing + rendu.
 */

export type FunnelEvent = {
  /** Type d'événement dans l'entonnoir. */
  kind: "scan" | "play" | "insta" | "review";
  /** Horodatage ISO de l'événement. */
  at: string;
};

export interface FunnelDay {
  date: string; // YYYY-MM-DD
  scans: number;
  plays: number;
  insta: number;
  reviewClicks: number;
}

/**
 * Jour civil (YYYY-MM-DD) d'un ISO, dans le fuseau `timeZone` (via Intl, donc
 * correct vis-à-vis de l'heure d'été). Défaut : Europe/Paris — un événement
 * juste après minuit à Paris tombe le bon jour côté commerçant, pas la veille
 * en UTC. Les tests injectent "UTC" pour rester déterministes.
 */
function dayKey(iso: string, timeZone: string): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  // en-CA formate en YYYY-MM-DD ; le fuseau fait le décalage (DST inclus).
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(t));
}

/**
 * Agrège des événements en lignes journalières, triées par date décroissante
 * (le plus récent en haut). Les dates invalides sont ignorées. Un jour sans
 * aucun événement n'apparaît pas (on n'invente pas de zéros). Le découpage des
 * jours suit `timeZone` (défaut Europe/Paris).
 */
export function bucketDailyFunnel(
  events: FunnelEvent[],
  timeZone: string = "Europe/Paris"
): FunnelDay[] {
  const byDay = new Map<string, FunnelDay>();
  for (const e of events) {
    const date = dayKey(e.at, timeZone);
    if (!date) continue;
    let row = byDay.get(date);
    if (!row) {
      row = { date, scans: 0, plays: 0, insta: 0, reviewClicks: 0 };
      byDay.set(date, row);
    }
    if (e.kind === "scan") row.scans++;
    else if (e.kind === "play") row.plays++;
    else if (e.kind === "insta") row.insta++;
    else if (e.kind === "review") row.reviewClicks++;
  }
  return [...byDay.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** Échappe un champ CSV (guillemets doublés, entouré de guillemets). */
function cell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

/**
 * Rendu CSV (sans BOM ; l'appelant ajoute le BOM UTF-8 pour Excel).
 * En-tête : date, scans, tours, instagram, clics_avis.
 */
export function funnelDailyToCsv(days: FunnelDay[]): string {
  const table: (string | number)[][] = [
    ["date", "scans", "tours", "instagram", "clics_avis"],
    ...days.map((d) => [d.date, d.scans, d.plays, d.insta, d.reviewClicks]),
  ];
  return table.map((r) => r.map(cell).join(",")).join("\n");
}
