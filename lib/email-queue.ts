import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

/**
 * File d'attente d'e-mails : découple l'ENFILEMENT (rapide, par le cron) de
 * l'ENVOI (par un drain, au rythme autorisé par Resend). Voir migration 0069.
 */

export type QueuedEmail = {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  marketing?: boolean;
  businessId?: string | null;
};

const MAX_ATTEMPTS = 5;

/** Ajoute un e-mail à la file. Renvoie true si l'insertion a réussi. */
export async function enqueueEmail(
  db: SupabaseClient,
  e: QueuedEmail
): Promise<boolean> {
  const { error } = await db.from("email_queue").insert({
    business_id: e.businessId ?? null,
    to_addr: e.to,
    subject: e.subject,
    html: e.html,
    from_name: e.fromName ?? null,
    marketing: !!e.marketing,
  });
  return !error;
}

/**
 * État suivant d'un message après une tentative d'envoi — logique PURE.
 *  - envoi OK → sent
 *  - échec définitif (clé absente : skipped) → failed (inutile de réessayer)
 *  - échec passager → pending tant qu'il reste des tentatives, sinon failed
 */
export function nextQueueState(
  attempts: number,
  ok: boolean,
  skipped?: boolean
): { status: "sent" | "pending" | "failed"; attempts: number } {
  const a = attempts + 1;
  if (ok) return { status: "sent", attempts: a };
  if (skipped) return { status: "failed", attempts: a };
  return { status: a >= MAX_ATTEMPTS ? "failed" : "pending", attempts: a };
}

/**
 * Vide la file (FIFO), séquentiellement pour respecter le débit Resend (le
 * backoff 429 est géré dans sendEmail). S'arrête à `max` messages ou quand
 * `deadlineMs` (instant epoch) est dépassé — pour tenir dans la fenêtre du cron.
 */
export async function drainEmailQueue(
  db: SupabaseClient,
  opts: { max: number; deadlineMs?: number }
): Promise<{ sent: number; failed: number; remaining: boolean }> {
  if (!Number.isFinite(opts.max) || opts.max <= 0) {
    return { sent: 0, failed: 0, remaining: false };
  }
  const { data: rows, error } = await db.rpc("claim_email_queue", {
    batch_size: opts.max,
  });
  if (error) throw new Error(`email_queue_claim_failed: ${error.message}`);

  let sent = 0;
  let failed = 0;
  let stoppedEarly = false;
  const list = rows ?? [];
  for (const r of list as any[]) {
    if (opts.deadlineMs && Date.now() > opts.deadlineMs) {
      stoppedEarly = true;
      break;
    }
    let res: { ok: boolean; skipped?: boolean; error?: string };
    if (r.marketing) {
      if (!r.business_id) throw new Error("marketing_email_missing_business_scope");
      const { data: hasConsent, error: consentError } = await db.rpc(
        "has_active_marketing_consent",
        { p_business_id: r.business_id, p_email: r.to_addr },
      );
      if (consentError) throw new Error(`marketing_consent_check_failed: ${consentError.message}`);
      res = hasConsent === true
        ? await sendEmail({
            to: r.to_addr,
            subject: r.subject,
            html: r.html,
            fromName: r.from_name ?? undefined,
            marketing: true,
          })
        : { ok: false, skipped: true, error: "marketing_consent_withdrawn" };
    } else {
      res = await sendEmail({
        to: r.to_addr,
        subject: r.subject,
        html: r.html,
        fromName: r.from_name ?? undefined,
        marketing: false,
      });
    }
    const next = nextQueueState(r.attempts ?? 0, res.ok, res.skipped);
    const { data: updatedRows, error: updateError } = await db
      .from("email_queue")
      .update({
        status: next.status,
        attempts: next.attempts,
        last_error: res.ok ? null : res.error ?? "error",
        locked_until: null,
        lock_token: null,
        ...(next.status === "sent" ? { sent_at: new Date().toISOString() } : {}),
      })
      .eq("id", r.id)
      .eq("lock_token", r.lock_token)
      .select("id");
    if (updateError) throw new Error(`email_queue_update_failed: ${updateError.message}`);
    if (!updatedRows?.length) throw new Error("email_queue_lease_lost_after_send");
    if (res.ok) sent++;
    else failed++;
  }
  // Reste-t-il du travail ? (lot plein sans deadline, ou arrêt anticipé)
  const remaining = stoppedEarly || list.length === opts.max;
  return { sent, failed, remaining };
}
