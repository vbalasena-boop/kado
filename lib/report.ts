import * as Sentry from "@sentry/nextjs";

/**
 * Signale une erreur à Sentry (si un DSN est configuré) et la journalise.
 * À utiliser dans les blocs catch critiques (facturation, crons, webhooks)
 * pour ne pas « avaler » silencieusement une vraie panne.
 */
export function reportError(err: unknown, context?: Record<string, unknown>) {
  try {
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {
    /* Sentry indisponible : on ne casse jamais le flux pour ça */
  }
  // Toujours un log serveur, même sans Sentry.
  console.error("[kado]", context?.where ?? "", err);
}
