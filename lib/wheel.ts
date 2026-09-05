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
 * Une action déclenchante est-elle sélectionnable dans l'éditeur (logique pure) ?
 *
 * Seule décision non triviale du gating : « Fidélité » (`loyalty`) n'est
 * sélectionnable que si le module fidélité est disponible dans la formule
 * (`fideliteAvailable`). Les autres actions autorisées (`instagram`, `optin`)
 * sont toujours sélectionnables. Toute valeur hors `TRIGGER_ACTIONS` → `false`.
 */
export function isTriggerActionSelectable(
  id: unknown,
  { fideliteAvailable }: { fideliteAvailable: boolean }
): boolean {
  if (id === "loyalty") return fideliteAvailable;
  if (id === "instagram" || id === "optin") return true;
  return false;
}

/**
 * Set EFFECTIF des actions déclenchantes compte tenu de la disponibilité du
 * module fidélité (logique pure). Normalise (`sanitizeTriggerActions`) PUIS
 * retire les actions non sélectionnables (ex. « loyalty » quand le module n'est
 * pas dans la formule), avec repli `["instagram"]`.
 *
 * C'est ce set qui doit être AFFICHÉ **et PERSISTÉ** : une action verrouillée
 * n'est jamais conservée dans la config, donc le jeu ne la propose plus après
 * enregistrement (même après une rétrogradation de formule).
 */
export function resolveTriggerActions(
  raw: unknown,
  { fideliteAvailable }: { fideliteAvailable: boolean }
): TriggerAction[] {
  const eff = sanitizeTriggerActions(raw).filter((id) =>
    isTriggerActionSelectable(id, { fideliteAvailable })
  );
  return eff.length > 0 ? eff : ["instagram"];
}

/**
 * Réducteur pur du toggle d'une action déclenchante dans l'éditeur.
 *  - part du set EFFECTIF (actions verrouillées déjà purgées) ;
 *  - une action non sélectionnable (ou non-string) ne change rien ;
 *  - on ne peut jamais retirer la dernière action active ;
 *  - l'ajout conserve l'ordre canonique de `TRIGGER_ACTIONS`.
 */
export function nextTriggerActions(
  current: unknown,
  id: unknown,
  { fideliteAvailable }: { fideliteAvailable: boolean }
): TriggerAction[] {
  const eff = resolveTriggerActions(current, { fideliteAvailable });
  if (
    typeof id !== "string" ||
    !isTriggerActionSelectable(id, { fideliteAvailable })
  ) {
    return eff;
  }
  const tid = id as TriggerAction;
  if (eff.includes(tid)) {
    if (eff.length <= 1) return eff; // dernière action : on refuse
    return eff.filter((a) => a !== tid);
  }
  return TRIGGER_ACTIONS.filter((o) => o === tid || eff.includes(o));
}

/**
 * Set EFFECTIF des tours débloqués côté JEU (logique pure). Normalise
 * (`sanitizeTriggerActions`) PUIS applique deux filets de sécurité :
 *  - `opts.loyaltyEnabled === false` → retire « loyalty » (la carte est
 *    désactivée → un tour fidélité mènerait à une carte inaccessible), avec
 *    repli `["instagram"]` ;
 *  - `opts.instagramLinked === false` → retire « instagram » (aucun lien
 *    Instagram renseigné : le bouton n'ouvrirait rien), SAUF si c'est la
 *    dernière action restante — le jeu ne doit jamais se retrouver sans tour,
 *    le tour est alors offert sans lien (comportement historique).
 *
 * Rétrocompatible : `opts` absent (ou option non passée) → comportement
 * strictement identique à `sanitizeTriggerActions`.
 */
export function unlockedSpinActions(
  triggerActions: unknown,
  opts?: { loyaltyEnabled?: boolean; instagramLinked?: boolean }
): TriggerAction[] {
  let eff: TriggerAction[] = sanitizeTriggerActions(triggerActions);
  if (opts?.loyaltyEnabled === false) {
    eff = eff.filter((a) => a !== "loyalty");
    if (eff.length === 0) eff = ["instagram"];
  }
  if (opts?.instagramLinked === false && eff.length > 1) {
    eff = eff.filter((a) => a !== "instagram");
  }
  return eff;
}

/**
 * Garde serveur (logique pure) : un `playType` est-il autorisé à débloquer un
 * tour compte tenu des actions déclenchantes configurées ?
 *  - `review` n'est JAMAIS autorisé (l'avis ne débloque plus rien) ;
 *  - lecture tolérante : `triggerActions` est normalisé par
 *    `sanitizeTriggerActions` (repli `["instagram"]` si absent/vide/invalide) ;
 *  - autorisé ⟺ le type figure dans le set EFFECTIF (`unlockedSpinActions`),
 *    c.-à-d. après les mêmes filets que côté jeu : « loyalty » refusée si
 *    `opts.loyaltyEnabled === false` (carte désactivée), « instagram » refusée
 *    si `opts.instagramLinked === false` ET qu'une autre action reste offerte.
 *  Rétrocompatible : `opts` absent → comportement inchangé.
 */
export function isTriggerActionAllowed(
  playType: unknown,
  triggerActions: unknown,
  opts?: { loyaltyEnabled?: boolean; instagramLinked?: boolean }
): boolean {
  if (typeof playType !== "string") return false;
  // L'avis n'est jamais une action déclenchante (défense en profondeur : il
  // n'appartient de toute façon pas à TRIGGER_ACTIONS après sanitisation).
  if (playType === "review") return false;
  return unlockedSpinActions(triggerActions, opts).includes(
    playType as TriggerAction
  );
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
  return hardenExternalUrl(cfg.review_url);
}

/**
 * Durcit une URL externe saisie par le commerçant et rendue dans un `href` /
 * ouverte via `window.open` côté joueur (logique pure, anti-XSS) :
 *  - `null` si absente/vide ou de type non-string ;
 *  - schéma `http(s)` conservé ; sans schéma → normalisé en `https://` ;
 *  - tout autre schéma explicite (`javascript:`, `data:`, `mailto:`, …) → `null`.
 * Mutualisé par `reviewCtaHref` et `instagramHref`.
 */
export function hardenExternalUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (s === "") return null;
  if (/^https?:\/\//i.test(s)) return s;
  // Un schéma explicite autre que http(s) est rejeté (anti-XSS).
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return null;
  // Domaine/chemin nu (sans schéma) → https://
  return `https://${s}`;
}

/**
 * URL Instagram sûre (ou `null`) pour l'action « Suivre sur Instagram ».
 * Même durcissement anti-XSS que `reviewCtaHref` : `instagram_url` est saisi par
 * le commerçant puis ouvert via `window.open` chez chaque joueur.
 */
export function instagramHref(cfg: { instagram_url?: unknown }): string | null {
  return hardenExternalUrl(cfg.instagram_url);
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
