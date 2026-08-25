import 'dotenv/config';

/** Configuration centrale, lue depuis les variables d'environnement (.env). */
export const config = {
  placesApiKey: process.env.GOOGLE_PLACES_API_KEY ?? '',
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  fromEmail: process.env.FROM_EMAIL ?? '',
  senderName: process.env.SENDER_NAME ?? '',
  senderBusiness: process.env.SENDER_BUSINESS ?? 'Kado',
  replyEmail: process.env.REPLY_EMAIL || process.env.FROM_EMAIL || '',
  dailyLimit: Number(process.env.DAILY_LIMIT ?? 5),
  projectionPerDay: Number(process.env.PROJECTION_PER_DAY ?? 1),
  demoUrl: process.env.DEMO_URL ?? '',
  dryRun: process.env.DRY_RUN === 'true',
};

/** Vérifie que les variables nécessaires à une commande sont présentes. */
export function requireEnv(keys: (keyof typeof config)[]): void {
  const missing = keys.filter((k) => !config[k] && config[k] !== 0);
  if (missing.length > 0) {
    console.error(
      `\n❌ Variables d'environnement manquantes : ${missing.join(', ')}\n` +
        `   Copie .env.example en .env et remplis-les.\n`,
    );
    process.exit(1);
  }
}
