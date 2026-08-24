import { Db, type Prospect } from './db';
import { findEmail } from './email-finder';
import { searchBusinesses, getWebsite } from './places';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Alimente la base de prospects à partir d'une recherche Google, ex :
 *   npm run seed -- "restaurant Lyon 6"
 * Pour chaque commerce (hors leader), on récupère son site puis son e-mail,
 * et on enregistre le Constat (son rang / ses avis vs le concurrent le plus fort).
 */
export async function seed(query: string): Promise<void> {
  if (!query.trim()) {
    console.error('Usage : npm run seed -- "restaurant Lyon 6"');
    process.exit(1);
  }

  const db = new Db();
  console.log(`\n🔎 Recherche Google Places : "${query}"`);
  const results = await searchBusinesses(query);
  if (results.length === 0) {
    console.log('Aucun résultat.');
    return;
  }

  // Le "concurrent le plus fort" = celui qui a le plus d'avis dans cette recherche.
  const leader = results.reduce((a, b) => (b.reviews > a.reviews ? b : a));
  console.log(
    `📊 ${results.length} commerces. Leader : ${leader.name} (${leader.reviews} avis).\n`,
  );

  let added = 0;
  let noWebsite = 0;
  let noEmail = 0;
  let skipped = 0;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.placeId === leader.placeId) continue; // on ne démarche pas le leader
    if (db.hasProspect(r.placeId)) {
      skipped++;
      continue;
    }

    const website = await getWebsite(r.placeId);
    if (!website) {
      noWebsite++;
      console.log(`  ·  ${r.name} — pas de site web (→ à faire en DM Instagram)`);
      continue;
    }

    const email = await findEmail(website);
    if (!email) {
      noEmail++;
      console.log(`  ·  ${r.name} — site trouvé mais aucun e-mail visible`);
      await sleep(400);
      continue;
    }

    const prospect: Prospect = {
      placeId: r.placeId,
      name: r.name,
      query,
      website,
      email,
      rank: i + 1,
      rating: r.rating,
      reviews: r.reviews,
      leaderName: leader.name,
      leaderReviews: leader.reviews,
      status: 'pending',
      addedAt: new Date().toISOString(),
    };
    db.addProspect(prospect);
    added++;
    console.log(`  ✅ ${r.name} — ${email}  (${r.reviews} avis, position ${i + 1})`);
    await sleep(400); // on reste poli avec les serveurs
  }

  db.save();
  console.log(
    `\n✨ Terminé : ${added} prospect(s) ajouté(s) · ${noEmail} sans e-mail · ` +
      `${noWebsite} sans site · ${skipped} déjà connus.`,
  );
}
