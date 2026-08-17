/** Horaires de commande : { "0".."6": ["HH:MM","HH:MM"] | null }.
 *  Clé = jour JavaScript (0 = dimanche). Absent/vide = toujours ouvert. */
export type OrderHours = Record<string, [string, string] | null>;

export const DAY_LABELS = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Heure courante à Paris (jour JS + minutes écoulées dans la journée). */
function parisNow(): { day: number; minutes: number } {
  const d = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" })
  );
  return { day: d.getDay(), minutes: d.getHours() * 60 + d.getMinutes() };
}

/** Des horaires sont-ils réellement configurés ? */
export function hasHours(h: OrderHours | null | undefined): boolean {
  if (!h) return false;
  return Object.values(h).some(
    (v) => Array.isArray(v) && TIME_RE.test(v[0]) && TIME_RE.test(v[1])
  );
}

/** Le commerce accepte-t-il les commandes en ce moment ? */
export function isOpenNow(h: OrderHours | null | undefined): boolean {
  if (!hasHours(h)) return true; // pas d'horaires = toujours ouvert
  const { day, minutes } = parisNow();
  const range = h![String(day)];
  if (!Array.isArray(range)) return false;
  return minutes >= toMinutes(range[0]) && minutes < toMinutes(range[1]);
}

/** Libellé de la prochaine ouverture (ex. « demain à 09:00 »), ou null. */
export function nextOpeningLabel(
  h: OrderHours | null | undefined
): string | null {
  if (!hasHours(h)) return null;
  const { day, minutes } = parisNow();
  for (let i = 0; i < 8; i++) {
    const d = (day + i) % 7;
    const range = h![String(d)];
    if (!Array.isArray(range)) continue;
    const start = toMinutes(range[0]);
    if (i === 0 && minutes >= start) continue; // déjà passé aujourd'hui
    const when =
      i === 0 ? "aujourd'hui" : i === 1 ? "demain" : DAY_LABELS[d];
    return `${when} à ${range[0]}`;
  }
  return null;
}

/** Valide et normalise des horaires reçus du commerçant. */
export function sanitizeHours(input: unknown): OrderHours | null {
  if (!input || typeof input !== "object") return null;
  const out: OrderHours = {};
  for (let d = 0; d < 7; d++) {
    const v = (input as Record<string, unknown>)[String(d)];
    if (
      Array.isArray(v) &&
      v.length === 2 &&
      typeof v[0] === "string" &&
      typeof v[1] === "string" &&
      TIME_RE.test(v[0]) &&
      TIME_RE.test(v[1]) &&
      toMinutes(v[0]) < toMinutes(v[1])
    ) {
      out[String(d)] = [v[0], v[1]];
    } else {
      out[String(d)] = null;
    }
  }
  return out;
}
