/**
 * Rappel « votre commande vous attend » — logique PURE (testable).
 *
 * On ne relance JAMAIS quelqu'un qui a déjà récupéré : le rappel n'est éligible
 * que si la commande est toujours « prête », que le client n'a pas confirmé le
 * retrait, qu'aucun rappel n'a déjà été envoyé, qu'il a une alerte push (sinon
 * on ne peut rien lui envoyer), et qu'un délai s'est écoulé depuis « prête ».
 */

export type ReminderOrder = {
  status?: string | null;
  notified_ready_at?: string | null;
  picked_up_at?: string | null;
  pickup_reminder_at?: string | null;
  notify_push?: unknown;
};

export const PICKUP_REMINDER_AFTER_MIN = 15;

export function isPickupReminderEligible(
  o: ReminderOrder,
  nowMs: number,
  minReadyMinutes = PICKUP_REMINDER_AFTER_MIN
): boolean {
  if (o.status !== "ready") return false;
  if (!o.notify_push) return false; // pas d'alerte push → rien à envoyer
  if (o.picked_up_at) return false; // client a confirmé le retrait
  if (o.pickup_reminder_at) return false; // déjà relancé une fois
  if (!o.notified_ready_at) return false;
  const readyAt = Date.parse(o.notified_ready_at);
  if (Number.isNaN(readyAt)) return false;
  return nowMs - readyAt >= minReadyMinutes * 60000;
}
