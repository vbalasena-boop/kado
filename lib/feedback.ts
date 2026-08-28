/**
 * Feedback privé « avant Google » — validation PURE (testable).
 * Le message est obligatoire ; l'e-mail est facultatif et simplement écarté
 * s'il est invalide (jamais une raison d'échec).
 */

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type FeedbackInput = { message?: unknown; email?: unknown };
export type FeedbackClean =
  | { ok: false }
  | { ok: true; message: string; email: string | null };

export function sanitizeFeedback(input: FeedbackInput): FeedbackClean {
  const message = String(input.message ?? "").trim().slice(0, 1000);
  if (!message) return { ok: false };
  const rawEmail = String(input.email ?? "").trim().toLowerCase().slice(0, 120);
  const email = rawEmail && EMAIL_RE.test(rawEmail) ? rawEmail : null;
  return { ok: true, message, email };
}
