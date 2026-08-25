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
  configured: boolean;
}

function imapConfig() {
  const host = process.env.PROSPECT_IMAP_HOST || process.env.PROSPECT_SMTP_HOST || "";
  const user = process.env.PROSPECT_IMAP_USER || process.env.PROSPECT_SMTP_USER || "";
  const pass = process.env.PROSPECT_IMAP_PASS || process.env.PROSPECT_SMTP_PASS || "";
  const port = Number(process.env.PROSPECT_IMAP_PORT || 993);
  return { host, user, pass, port };
}

/** Récupère les adresses expéditrices des emails reçus depuis N jours. */
async function recentSenders(sinceDays: number): Promise<Set<string>> {
  const { host, user, pass, port } = imapConfig();
  const senders = new Set<string>();
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
    for await (const msg of client.fetch({ since }, { envelope: true })) {
      const from = msg.envelope?.from?.[0]?.address;
      if (from) senders.add(from.toLowerCase());
    }
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }
  return senders;
}

/**
 * Détecte les réponses et marque les prospects correspondants "replied".
 * Ne lève pas : renvoie un résumé exploitable (cron/admin).
 */
export async function runReplyDetection(sinceDays = 14): Promise<ReplySummary> {
  const { host, user, pass } = imapConfig();
  if (!host || !user || !pass) {
    return { scanned: 0, matched: 0, configured: false };
  }

  let senders: Set<string>;
  try {
    senders = await recentSenders(sinceDays);
  } catch (err) {
    reportError(err, { where: "prospection.runReplyDetection" });
    return { scanned: 0, matched: 0, configured: true };
  }

  const db = getAdminClient();
  // Prospects déjà contactés (ont un email), pas encore marqués répondu/exclus.
  const { data } = await db
    .from("prospects")
    .select("id, email, status")
    .not("email", "is", null)
    .limit(5000);

  let matched = 0;
  for (const p of data ?? []) {
    const email = (p.email as string).toLowerCase();
    if (!senders.has(email)) continue;
    if (NON_CONTACTABLE_STATUSES.includes(p.status as ProspectStatus)) continue;

    const { error } = await db
      .from("prospects")
      .update({ status: "replied", updated_at: new Date().toISOString() })
      .eq("id", p.id);
    if (error) continue;
    matched++;
    await db
      .from("prospect_events")
      .insert({ prospect_id: p.id, type: "email_replied", meta: { auto: true } });
  }

  return { scanned: senders.size, matched, configured: true };
}
