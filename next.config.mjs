import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Nécessaire sous Next 14 pour charger instrumentation.ts (Sentry serveur).
  experimental: {
    instrumentationHook: true,
  },
};

// L'enrobage Sentry n'envoie rien sans DSN (voir sentry.*.config.ts). Le
// téléversement des source maps ne se fait que si SENTRY_AUTH_TOKEN est défini.
export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  disableLogger: true,
  // N'échoue jamais le build à cause de Sentry.
  telemetry: false,
});
