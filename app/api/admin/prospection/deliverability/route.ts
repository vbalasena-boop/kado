import { promises as dns } from "node:dns";
import { adminRoute } from "@/lib/api";
import {
  buildDeliverabilityReport,
  domainFromAddress,
} from "@/lib/prospection/deliverability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Test de délivrabilité (admin) : vérifie SPF / DKIM / DMARC / MX du domaine
 * d'envoi de prospection (déduit de PROSPECT_EMAIL_FROM). 100 % gratuit, via
 * de simples résolutions DNS. Aucun envoi réel.
 */
export const GET = adminRoute({
  handler: async () => {
    const domain =
      domainFromAddress(process.env.PROSPECT_EMAIL_FROM) ||
      domainFromAddress(process.env.PROSPECT_REPLY_TO);

    const report = await buildDeliverabilityReport(domain, {
      resolveMx: (host) => dns.resolveMx(host),
      resolveTxt: (host) => dns.resolveTxt(host),
    });

    return Response.json({ ok: true, ...report });
  },
});
