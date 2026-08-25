/**
 * Prospection Kado — détection automatique des réponses (story D5 auto).
 *
 * Lit la boîte IMAP dédiée (celle qui envoie la prospection) et, pour chaque
 * expéditeur correspondant à un prospect déjà contacté, passe son statut à
 * "replied". 100 % gratuit (utilise la boîte OVH existante).
 *
 * Réutilise les identifiants SMTP par défaut si les variables IMAP dédiées ne
 * sont pas définies. Serveur IMAP OVH par défaut : ssl0.ovh.net:993 (SSL).
 */
import { ImapFlow } from "imapflow";
import { getAdminClient } from "@/lib/supabase/admin";
import { reportError } from "@/lib/report";
import { NON_CONTACTABLE_STATUSES, type ProspectStatus } from "@/lib/prospection/types";

export interface ReplySummary {
  scanned: number;
  matched: number;
  bounced: number;
  configured: boolean;
}

function imapConfig() {
  const host = process.env.PROSPECT_IMAP_HOST || process.env.PROSPECT_SMTP_HOST || "";
  const user = process.env.PROSPECT_IMAP_USER || process.env.PROSPECT_SMTP_USER || "";
  const pass = process.env.PROSPECT_IMAP_PASS || process.env.PROSPECT_SMTP_PASS || "";
  const port = Number(process.env.PROSPECT_IMAP_PORT || 993);
  return { host, user, pass, port };
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const DAEMON_RE = /(mailer-daemon|postmaster|mail delivery|delivery status|no-?reply)/i;

interface ScanResult {
  senders: Set<string>; // expéditeurs "normaux" (réponses potentielles)
  bounced: Set<string>; // adresses en échec (extraites des rapports de bounce)
}

/** Scanne l'INBOX : expéditeurs de réponses + adresses en échec (bounces). */
async function scanInbox(sinceDays: number): Promise<ScanResult> {
  const { host, user, pass, port } = imapConfig();
  const senders = new Set<string>();
  const bounced = new Set<string>();
  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: { user, pass },
    logger: false,
  });
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  try {
    const since = new Date(Date.now() - sinceDays * 86_400_000);
    for await (const msg of client.fetch({ since }, { envelope: true, source: true })) {
      const from = msg.envelope?.from?.[0]?.address?.toLowerCase() ?? "";
      const subject = msg.envelope?.subject ?? "";
      const isBounce = DAEMON_RE.test(from) || DAEMON_RE.test(subject);
      if (isBounce) {
        // Rapport de non-remise : on extrait les adresses en échec du corps.
        const body = msg.source ? msg.source.toString("utf8") : "";
        for (const m of body.matchAll(EMAIL_RE)) {
          const e = m[0].toLowerCase();
          // Ignore l'adresse d'envoi et les adresses techniques.
          if (e === user.toLowerCase() || DAEMON_RE.test(e)) continue;
          bounced.add(e);
        }
      } else if (from) {
        senders.add(from);
      }
    }
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }
  return { senders, bounced };
}

/**
 * Détecte les réponses et marque les prospects correspondants "replied".
 * Ne lève pas : renvoie un résumé exploitable (cron/admin).
 */
export async function runReplyDetection(sinceDays = 14): Promise<ReplySummary> {
  const { host, user, pass } = imapConfig();
  if (!host || !user || !pass) {
    return { scanned: 0, matched: 0, bounced: 0, configured: false };
  }

  let scan: ScanResult;
  try {
    scan = await scanInbox(sinceDays);
  } catch (err) {
    reportError(err, { where: "prospection.runReplyDetection" });
    return { scanned: 0, matched: 0, bounced: 0, configured: true };
  }

  const db = getAdminClient();
  const { data } = await db
    .from("prospects")
    .select("id, email, status")
    .not("email", "is", null)
    .limit(5000);
  const prospects = (data ?? []) as { id: string; email: string; status: ProspectStatus }[];

  const now = new Date().toISOString();
  let matched = 0;
  let bounced = 0;

  for (const p of prospects) {
    const email = p.email.toLowerCase();

    // 1) Bounce → suppression (ne plus jamais contacter) + statut exclu.
    if (scan.bounced.has(email)) {
      await db.from("suppression_list").upsert({ email, reason: "bounced" }, { onConflict: "email" });
      await db
        .from("prospects")
        .update({ status: "excluded", exclude_reason: "email invalide (bounce)", updated_at: now })
        .eq("id", p.id);
      await db.from("prospect_events").insert({ prospect_id: p.id, type: "email_bounced", meta: { auto: true } });
      bounced++;
      continue;
    }

    // 2) Réponse → statut "A répondu".
    if (scan.senders.has(email) && !NON_CONTACTABLE_STATUSES.includes(p.status)) {
      const { error } = await db
        .from("prospects")
        .update({ status: "replied", updated_at: now })
        .eq("id", p.id);
      if (error) continue;
      matched++;
      await db.from("prospect_events").insert({ prospect_id: p.id, type: "email_replied", meta: { auto: true } });
    }
  }

  return { scanned: scan.senders.size, matched, bounced, configured: true };
}
