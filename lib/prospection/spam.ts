/**
 * Prospection Kado — détecteur de marqueurs spam (story C3).
 *
 * Heuristique simple et pure : signale les éléments qui font tomber un email
 * en spam (mots déclencheurs, excès de majuscules / ponctuation / liens /
 * emojis). Sert à alerter l'opérateur avant l'envoi — ne bloque pas.
 */

export interface SpamCheck {
  risky: boolean;
  flags: string[];
}

// Mots/expressions déclencheurs classiques (cold email FR).
const TRIGGER_WORDS = [
  "gratuit",
  "100%",
  "gagnez",
  "argent",
  "cash",
  "promo",
  "offre limitée",
  "urgent",
  "cliquez ici",
  "félicitations",
  "meilleur prix",
];

const URL_RE = /https?:\/\/[^\s]+/gi;
const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu;

/** Analyse un texte (objet + corps) et renvoie les alertes spam. */
export function spamCheck(text: string): SpamCheck {
  const flags: string[] = [];
  const lower = text.toLowerCase();

  const triggered = TRIGGER_WORDS.filter((w) => lower.includes(w));
  if (triggered.length > 0) {
    flags.push(`Mots à risque : ${triggered.join(", ")}`);
  }

  // Excès de MAJUSCULES (mots de 4+ lettres tout en capitales).
  const capsWords = text.match(/\b[A-ZÀ-Þ]{4,}\b/g) ?? [];
  if (capsWords.length >= 3) {
    flags.push(`Trop de mots en majuscules (${capsWords.length})`);
  }

  // Ponctuation excessive.
  if (/[!?]{2,}/.test(text)) {
    flags.push("Ponctuation excessive (!! ou ??)");
  }
  const exclam = (text.match(/!/g) ?? []).length;
  if (exclam >= 4) {
    flags.push(`Trop de points d'exclamation (${exclam})`);
  }

  // Trop de liens.
  const urls = text.match(URL_RE) ?? [];
  if (urls.length >= 4) {
    flags.push(`Trop de liens (${urls.length})`);
  }

  // Trop d'emojis.
  const emojis = text.match(EMOJI_RE) ?? [];
  if (emojis.length >= 6) {
    flags.push(`Trop d'emojis (${emojis.length})`);
  }

  return { risky: flags.length > 0, flags };
}
