import { config } from './config';
import { Db } from './db';
import { sendToProspect } from './sender';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Envoie les prochains mails personnalisés, dans la limite quotidienne.
 *   npm run send
 * Respecte : plafond DAILY_LIMIT, liste de suppression, et 1 seul mail par adresse.
 */
export async function run(): Promise<void> {
  const db = new Db();

  const already = db.sentToday();
  const remaining = Math.max(0, config.dailyLimit - already);
  if (remaining === 0) {
    console.log(
      `📭 Quota du jour atteint (${already}/${config.dailyLimit}). Rien à envoyer.`,
    );
    return;
  }

  const queue = db.prospects.filter(
    (p) =>
      p.status === 'pending' &&
      p.email &&
      !db.isSuppressed(p.email) &&
      !db.alreadyEmailed(p.email),
  );

  if (queue.length === 0) {
    console.log('📭 Aucun prospect en attente. Lance `npm run seed -- "…"`.');
    return;
  }

  const batch = queue.slice(0, remaining);
  console.log(
    `\n📨 Envoi de ${batch.length} mail(s) (quota ${already}/${config.dailyLimit})` +
      `${config.dryRun ? ' — MODE SIMULATION' : ''}\n`,
  );

  let sent = 0;
  for (const p of batch) {
    const outcome = await sendToProspect(p);
    if (outcome.ok) {
      db.recordSent({
        email: p.email!,
        placeId: p.placeId,
        name: p.name,
        subject: outcome.subject,
        sentAt: new Date().toISOString(),
      });
      db.markStatus(p.placeId, 'contacted');
      db.save(); // on persiste après CHAQUE envoi (anti-double-envoi si crash)
      sent++;
      console.log(`  ✅ ${p.name} <${p.email}>`);
    } else {
      console.log(`  ❌ ${p.name} <${p.email}> — ${outcome.error}`);
    }
    await sleep(1500);
  }

  console.log(`\n✨ ${sent}/${batch.length} mail(s) envoyé(s).`);
}
