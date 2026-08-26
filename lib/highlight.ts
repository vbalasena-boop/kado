import { hardenExternalUrl } from "@/lib/wheel";

/**
 * « À la une » : bloc de contenu éditable par le commerçant (menu du jour,
 * événement, actu…), affiché aux clients sur la page de jeu et la carte de
 * fidélité. Cette logique PURE décide s'il y a quelque chose à montrer.
 */

export type HighlightInput = {
  highlight_title?: string | null;
  highlight_text?: string | null;
  highlight_url?: string | null;
  highlight_until?: string | null;
};

export type Highlight = {
  title: string;
  text: string;
  url: string | null;
};

/**
 * Renvoie le bloc à afficher, ou `null` s'il n'y a rien à montrer :
 *  - vide (ni titre ni message) → null ;
 *  - expiré (date « masquer après » DÉPASSÉE, c.-à-d. antérieure à aujourd'hui) → null ;
 *  - sinon → titre/message nettoyés + URL DURCIE (anti-XSS).
 *
 * `todayIso` et `highlight_until` sont au format `AAAA-MM-JJ` : la comparaison
 * lexicographique équivaut à une comparaison de dates. Le bloc reste visible LE
 * jour de la date de fin (masqué le lendemain).
 */
export function visibleHighlight(
  cfg: HighlightInput | null | undefined,
  todayIso: string
): Highlight | null {
  if (!cfg) return null;
  const title = (cfg.highlight_title ?? "").trim();
  const text = (cfg.highlight_text ?? "").trim();
  if (!title && !text) return null;
  const until = (cfg.highlight_until ?? "").slice(0, 10);
  if (until && until < todayIso) return null;
  return { title, text, url: hardenExternalUrl(cfg.highlight_url) };
}
