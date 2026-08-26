/**
 * Rétention RGPD du journal de consentement (`consent_events`).
 *
 * La purge s'exécute en PROD via la fonction SQL `purge_old_consent_events`
 * (migration 0052), appelée par le cron quotidien — c'est la source de vérité.
 * Ce module en est le MIROIR pur/testable : il documente et verrouille la règle,
 * en particulier l'invariant critique « ne jamais supprimer la preuve de l'état
 * de consentement le plus récent d'un sujet ».
 */

/** Fenêtre de rétention par défaut : ~3 ans. */
export const CONSENT_RETENTION_DAYS = 1095;

export type ConsentEventLike = {
  id: string;
  business_id: string;
  email: string;
  created_at: string; // ISO 8601
};

/** Clé de sujet : une personne = (commerce, e-mail). */
function subjectKey(e: ConsentEventLike): string {
  return `${e.business_id} ${e.email}`;
}

/**
 * Ids des événements à PURGER : plus vieux que la fenêtre de rétention ET
 * remplacés par un événement PLUS RÉCENT du même sujet. Le dernier événement de
 * chaque sujet n'est jamais renvoyé (preuve de l'état courant conservée), même
 * s'il dépasse la fenêtre. Équivaut à la clause `exists (… created_at > …)`
 * de la fonction SQL.
 */
export function consentIdsToPurge(
  events: ConsentEventLike[],
  retentionDays: number,
  nowMs: number
): string[] {
  const cutoff = nowMs - retentionDays * 86_400_000;

  // Dernier horodatage connu par sujet.
  const latest = new Map<string, number>();
  for (const e of events) {
    const k = subjectKey(e);
    const t = Date.parse(e.created_at);
    const cur = latest.get(k);
    if (cur === undefined || t > cur) latest.set(k, t);
  }

  const ids: string[] = [];
  for (const e of events) {
    const t = Date.parse(e.created_at);
    if (t >= cutoff) continue; // dans la fenêtre → conservé
    // Un événement strictement plus récent existe pour ce sujet ?
    if (t < (latest.get(subjectKey(e)) ?? t)) ids.push(e.id);
  }
  return ids;
}
