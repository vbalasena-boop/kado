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
import { notifyProspectActivity } from "@/lib/prospection/notify";

export interface ReplySummary {
  scanned: number;
  matched: number;
  bounced: number;
  /** RDV Calendly détectés (prospects passés « Intéressé »). */
  booked: number;
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
// Vrais indicateurs de non-remise. On NE met PAS « no-reply » ici : trop
// d'expéditeurs légitimes (Calendly, notifications…) émettent depuis no-reply,
// et les classer en bounce excluait leurs contacts à tort.
const DAEMON_RE = /(mailer-daemon|postmaster|mail delivery|delivery status|delivery failure|undeliverable|failure notice|non[-\s]?remis|échec de (?:remise|distribution))/i;
const CALENDLY_RE = /calendly\.com/i;
// Mots-clés d'une confirmation de réservation (multilingue) — pour distinguer un
// vrai RDV d'un simple email qui mentionne calendly.com (ex. signature).
const BOOKING_RE = /(scheduled|programm|réserv|nouvel[\s-]*événement|new event|confirm|invit)/i;

interface ScanResult {
  senders: Set<string>; // expéditeurs "normaux" (réponses potentielles)
  bounced: Set<string>; // adresses en échec (extraites des rapports de bounce)
  booked: Set<string>; // invités ayant réservé un RDV (emails Calendly)
}

/** Scanne l'INBOX : réponses + bounces + réservations Calendly. */
async function scanInbox(sinceDays: number): Promise<ScanResult> {
  const { host, user, pass, port } = imapConfig();
  const senders = new Set<string>();
  const bounced = new Set<string>();
  const booked = new Set<string>();
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
      const body = msg.source ? msg.source.toString("utf8") : "";
      const isBounce = DAEMON_RE.test(from) || DAEMON_RE.test(subject);
      // Robuste au transfert : le From peut être ta boîte, mais le corps garde
      // les liens calendly.com. On exige aussi un mot-clé de réservation.
      const isCalendly =
        CALENDLY_RE.test(from) ||
        (CALENDLY_RE.test(body) && BOOKING_RE.test(`${subject} ${body}`));

      // Calendly d'ABORD : une notif de réservation peut venir d'un no-reply@,
      // mais ne doit jamais être prise pour un bounce.
      if (isCalendly) {
        // Notification Calendly : on extrait l'email de l'invité (le prospect).
        // Seules les adresses présentes dans la table prospects seront agies.
        for (const m of body.matchAll(EMAIL_RE)) {
          const e = m[0].toLowerCase();
          if (e === user.toLowerCase() || CALENDLY_RE.test(e) || DAEMON_RE.test(e)) continue;
          booked.add(e);
        }
      } else if (isBounce) {
        // Rapport de non-remise : on extrait les adresses en échec du corps.
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
  return { senders, bounced, booked };
}

/**
 * Détecte les réponses et marque les prospects correspondants "replied".
 * Ne lève pas : renvoie un résumé exploitable (cron/admin).
 */
export async function runReplyDetection(
  sinceDays = 14,
  opts?: { notify?: boolean }
): Promise<ReplySummary> {
  const { host, user, pass } = imapConfig();
  if (!host || !user || !pass) {
    return { scanned: 0, matched: 0, bounced: 0, booked: 0, configured: false };
  }

  let scan: ScanResult;
  try {
    scan = await scanInbox(sinceDays);
  } catch (err) {
    reportError(err, { where: "prospection.runReplyDetection" });
    return { scanned: 0, matched: 0, bounced: 0, booked: 0, configured: true };
  }

  const db = getAdminClient();
  const { data } = await db
    .from("prospects")
    .select("id, name, email, status")
    .not("email", "is", null)
    .limit(5000);
  const prospects = (data ?? []) as { id: string; name: string; email: string; status: ProspectStatus }[];

  const now = new Date().toISOString();
  let matched = 0;
  let bounced = 0;
  let booked = 0;
  const repliedNames: string[] = [];
  const bookedNames: string[] = [];

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

    // 2) RDV Calendly réservé → statut "Intéressé" (signal le plus fort).
    if (scan.booked.has(email) && p.status !== "client" && p.status !== "excluded") {
      const { error } = await db
        .from("prospects")
        .update({ status: "interested", updated_at: now })
        .eq("id", p.id);
      if (!error) {
        booked++;
        bookedNames.push(p.name);
        await db.from("prospect_events").insert({ prospect_id: p.id, type: "meeting_booked", meta: { auto: true } });
      }
      continue;
    }

    // 3) Réponse → statut "A répondu".
    if (scan.senders.has(email) && !NON_CONTACTABLE_STATUSES.includes(p.status)) {
      const { error } = await db
        .from("prospects")
        .update({ status: "replied", updated_at: now })
        .eq("id", p.id);
      if (error) continue;
      matched++;
      repliedNames.push(p.name);
      await db.from("prospect_events").insert({ prospect_id: p.id, type: "email_replied", meta: { auto: true } });
    }
  }

  // Notifie l'opérateur (sauf si désactivé — ex. clic manuel dans l'admin).
  if (opts?.notify !== false) {
    await notifyProspectActivity({ replied: repliedNames, booked: bookedNames });
  }

  return { scanned: scan.senders.size, matched, bounced, booked, configured: true };
}
