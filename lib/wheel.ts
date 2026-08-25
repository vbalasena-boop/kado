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
