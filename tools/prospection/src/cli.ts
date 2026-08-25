import { config, requireEnv } from './config';
import { Db } from './db';
import { run } from './run';
import { seed } from './seed';

function usage(): void {
  console.log(`
Agent de prospection Kado

Commandes :
  npm run seed -- "<recherche>"   Trouve des commerces + e-mails (ex : "restaurant Lyon 6")
  npm run send                    Envoie les prochains mails (max ${config.dailyLimit}/jour)
  npm run stats                   Affiche l'état de la base
  npm run list                    Liste les prospects en attente
  npm run suppress -- <email>     Ne plus jamais contacter cette adresse (réponse STOP)
`);
}

function showStats(): void {
  const s = new Db().stats();
  console.log(`
📊 État de la prospection
  Prospects          : ${s.total}  (${s.withEmail} avec e-mail)
  En attente         : ${s.pending}
  Contactés          : ${s.contacted}
  Mails envoyés      : ${s.sentTotal}  (dont ${s.sentToday} aujourd'hui / ${config.dailyLimit})
  Désinscrits (STOP) : ${s.suppressed}
`);
}

function listPending(): void {
  const db = new Db();
  const pending = db.prospects.filter((p) => p.status === 'pending' && p.email);
  if (pending.length === 0) {
    console.log('Aucun prospect en attente.');
    return;
  }
  console.log(`\n${pending.length} prospect(s) en attente :\n`);
  for (const p of pending) {
    console.log(
      `  ${p.name}  <${p.email}>  — ${p.reviews} avis vs ${p.leaderReviews} (${p.leaderName})`,
    );
  }
  console.log('');
}

function suppress(email: string): void {
  if (!email) {
    console.error('Usage : npm run suppress -- contact@exemple.fr');
    process.exit(1);
  }
  const db = new Db();
  db.addSuppression(email);
  db.save();
  console.log(`🚫 ${email} ne sera plus jamais contacté.`);
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const arg = rest.join(' ').trim();

  switch (command) {
    case 'seed':
      requireEnv(['placesApiKey']);
      await seed(arg);
      break;
    case 'run':
    case 'send':
      requireEnv(['resendApiKey', 'fromEmail', 'senderName', 'replyEmail']);
      await run();
      break;
    case 'stats':
      showStats();
      break;
    case 'list':
      listPending();
      break;
    case 'suppress':
      suppress(arg);
      break;
    default:
      usage();
  }
}

main().catch((err) => {
  console.error('\n💥 Erreur :', err.message ?? err);
  process.exit(1);
});
