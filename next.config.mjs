import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Nécessaire sous Next 14 pour charger instrumentation.ts (Sentry serveur).
  experimental: {
    instrumentationHook: true,
  },
  // En-têtes de sécurité appliqués à toutes les réponses.
  // `frame-ancestors 'none'` + X-Frame-Options : anti-clickjacking (les espaces
  // /dashboard et /admin ne peuvent plus être encadrés dans une iframe piégée).
  // On n'impose PAS de CSP `script-src` restrictive ici (Stripe, Sentry, Vercel
  // Analytics chargent des scripts) — à durcir séparément après recensement.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
    ];
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
