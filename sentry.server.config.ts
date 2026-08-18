// Sentry côté serveur. Inerte tant qu'aucun DSN n'est fourni (clé à mettre
// dans Vercel : SENTRY_DSN ou NEXT_PUBLIC_SENTRY_DSN). Aucune donnée n'est
// envoyée sans DSN.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: process.env.VERCEL_ENV || "development",
  tracesSampleRate: 0.1,
});
