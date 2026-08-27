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

/**
 * Ouvert à un instant donné (jour JS 0-6 + minutes écoulées) ? Logique PURE,
 * gère les créneaux à cheval sur minuit. Suppose des horaires configurés.
 */
export function isOpenAt(
  h: OrderHours,
  day: number,
  minutes: number
): boolean {
  // Créneau d'aujourd'hui — éventuellement à cheval sur minuit (from > to,
  // ex. 18:00–01:00). La partie « du soir » (avant minuit) est ici ; la partie
  // « petit matin » relève du créneau de la VEILLE.
  const today = h[String(day)];
  if (Array.isArray(today)) {
    const s = toMinutes(today[0]);
    const e = toMinutes(today[1]);
    if (s < e) {
      if (minutes >= s && minutes < e) return true;
    } else if (minutes >= s) {
      return true; // créneau nocturne, partie avant minuit
    }
  }

  // Fin d'un créneau de la VEILLE qui déborde après minuit (petit matin).
  const yesterday = h[String((day + 6) % 7)];
  if (Array.isArray(yesterday)) {
    const s = toMinutes(yesterday[0]);
    const e = toMinutes(yesterday[1]);
    if (s > e && minutes < e) return true;
  }

  return false;
}

/** Le commerce accepte-t-il les commandes en ce moment ? */
export function isOpenNow(h: OrderHours | null | undefined): boolean {
  if (!hasHours(h)) return true; // pas d'horaires = toujours ouvert
  const { day, minutes } = parisNow();
  return isOpenAt(h!, day, minutes);
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
      // from ≠ to : `from < to` = créneau normal, `from > to` = à cheval sur
      // minuit (ex. 18:00–01:00). Seul `from == to` (nul/ambigu) est rejeté.
      toMinutes(v[0]) !== toMinutes(v[1])
    ) {
      out[String(d)] = [v[0], v[1]];
    } else {
      out[String(d)] = null;
    }
  }
  return out;
}
