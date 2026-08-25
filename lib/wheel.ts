// Config des actions déclenchantes (non-avis) — logique pure, testable.
// L'avis Google n'apparaît JAMAIS ici : il n'est jamais une action récompensée.

/** Actions autorisées pour débloquer un tour (sous-ensemble figé). */
export const TRIGGER_ACTIONS = ["instagram", "loyalty", "optin"] as const;

export type TriggerAction = (typeof TRIGGER_ACTIONS)[number];

/**
 * Normalise une liste d'actions déclenchantes :
 *  - ne garde que les valeurs autorisées (`instagram|loyalty|optin`) ;
 *  - déduplique en conservant l'ordre de première apparition ;
 *  - garde-fou : au moins une action active → repli `["instagram"]`.
 * Toute entrée non-tableau (null/undefined/string/…) retombe sur le repli.
 */
export function sanitizeTriggerActions(input: unknown): TriggerAction[] {
  if (!Array.isArray(input)) return ["instagram"];
  const allowed = new Set<string>(TRIGGER_ACTIONS);
  const out: TriggerAction[] = [];
  for (const v of input) {
    if (typeof v === "string" && allowed.has(v) && !out.includes(v as TriggerAction)) {
      out.push(v as TriggerAction);
    }
  }
  return out.length > 0 ? out : ["instagram"];
}

/**
 * Garde serveur (logique pure) : un `playType` est-il autorisé à débloquer un
 * tour compte tenu des actions déclenchantes configurées ?
 *  - `review` n'est JAMAIS autorisé (l'avis ne débloque plus rien) ;
 *  - lecture tolérante : `triggerActions` est normalisé par
 *    `sanitizeTriggerActions` (repli `["instagram"]` si absent/vide/invalide) ;
 *  - autorisé ⟺ le type figure dans la liste normalisée.
 */
export function isTriggerActionAllowed(
  playType: unknown,
  triggerActions: unknown
): boolean {
  if (typeof playType !== "string") return false;
  // L'avis n'est jamais une action déclenchante (défense en profondeur : il
  // n'appartient de toute façon pas à TRIGGER_ACTIONS après sanitisation).
  if (playType === "review") return false;
  const allowed = sanitizeTriggerActions(triggerActions);
  return allowed.includes(playType as TriggerAction);
}

/**
 * URL sûre du CTA « Avis Google » neutre, ou `null` s'il ne doit pas s'afficher
 * (logique pure).
 *
 * Le CTA est un lien facultatif, NON récompensé : il n'est jamais lié à un
 * cadeau ou à un tour. Cette fonction n'accepte QUE `review_enabled` et
 * `review_url` — l'absence de tout paramètre de note/satisfaction rend le
 * *review gating* structurellement impossible.
 *
 * `review_url` est saisi par le commerçant et rendu tel quel dans un `href`
 * visible par tous les joueurs : on le durcit ici.
 *  - `null` si l'avis est désactivé (`review_enabled === false`) ou si
 *    `review_url` est absent/vide (masqué proprement, jamais de lien vide) ;
 *  - schéma `http(s)` conservé ; sans schéma → normalisé en `https://` ;
 *  - tout autre schéma explicite (`javascript:`, `data:`, `mailto:`, …) → `null`
 *    (défense anti-XSS : jamais de href actif hostile chez le joueur).
 */
export function reviewCtaHref(cfg: {
  review_enabled?: unknown;
  review_url?: unknown;
}): string | null {
  if (cfg.review_enabled === false) return null;
  if (typeof cfg.review_url !== "string") return null;
  const raw = cfg.review_url.trim();
  if (raw === "") return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  // Un schéma explicite autre que http(s) est rejeté.
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null;
  // Domaine/chemin nu (sans schéma) → https://
  return `https://${raw}`;
}

/**
 * Le CTA avis neutre doit-il s'afficher ? Vrai ⟺ `reviewCtaHref` fournit une URL
 * sûre. (Même garantie « pas de review gating » : aucun paramètre de note.)
 */
export function shouldShowReviewCta(cfg: {
  review_enabled?: unknown;
  review_url?: unknown;
}): boolean {
  return reviewCtaHref(cfg) !== null;
}

/**
 * Décision « établissement concerné par la migration avis » (logique pure).
 *
 * Vrai ⟺ l'avis était *utilisé* pour débloquer un tour avant sa neutralisation
 * (9.2/9.3) : avis actif (`review_enabled !== false`, défaut tolérant) ET lien
 * renseigné (`review_url` string non vide après trim). Sert uniquement à décider
 * si la bannière d'information (Story 9.4) doit s'afficher au commerçant.
 *
 * Distinct de `shouldShowReviewCta` (intention différente : notice commerçant vs
 * CTA joueur) même si la condition se recoupe aujourd'hui. AUCUN paramètre de
 * note/satisfaction : la décision ne dépend jamais d'une note (garantie
 * structurelle « pas de review gating »).
 */
export function avisMigrationNoticeNeeded(cfg: {
  review_enabled?: unknown;
  review_url?: unknown;
}): boolean {
  if (cfg.review_enabled === false) return false;
  if (typeof cfg.review_url !== "string") return false;
  return cfg.review_url.trim() !== "";
}
