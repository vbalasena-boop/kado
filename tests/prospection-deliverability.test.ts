import { describe, it, expect } from "vitest";
import {
  domainFromAddress,
  buildDeliverabilityReport,
  type DnsResolvers,
} from "@/lib/prospection/deliverability";

describe("domainFromAddress", () => {
  it("extrait le domaine d'une adresse simple", () => {
    expect(domainFromAddress("a@kado-pro.fr")).toBe("kado-pro.fr");
  });
  it("extrait le domaine d'une adresse « Nom <a@b> »", () => {
    expect(domainFromAddress("Kado <bonjour@Kado-Pro.FR>")).toBe("kado-pro.fr");
  });
  it("renvoie null si absent/invalide", () => {
    expect(domainFromAddress(undefined)).toBeNull();
    expect(domainFromAddress("pasdemail")).toBeNull();
  });
});

/** Construit un jeu de résolveurs DNS factices. */
function fakeDns(opts: {
  mx?: { exchange: string; priority: number }[];
  txt?: Record<string, string[][]>;
}): DnsResolvers {
  return {
    resolveMx: async () => {
      if (!opts.mx) throw new Error("ENOTFOUND");
      return opts.mx;
    },
    resolveTxt: async (host: string) => {
      const rec = opts.txt?.[host];
      if (!rec) throw new Error("ENOTFOUND");
      return rec;
    },
  };
}

describe("buildDeliverabilityReport", () => {
  it("renvoie un rapport non configuré sans domaine", async () => {
    const r = await buildDeliverabilityReport(null, fakeDns({}));
    expect(r.configured).toBe(false);
    expect(r.score).toBe(0);
    expect(r.checks).toHaveLength(0);
  });

  it("score parfait quand SPF/DKIM/DMARC(reject)/MX sont présents", async () => {
    const domain = "kado-pro.fr";
    const dns = fakeDns({
      mx: [{ exchange: "mx1.ovh.net", priority: 1 }],
      txt: {
        [domain]: [["v=spf1 include:mx.ovh.com ~all"]],
        [`ovhmx1._domainkey.${domain}`]: [["v=DKIM1; k=rsa; p=ABC"]],
        [`_dmarc.${domain}`]: [["v=DMARC1; p=reject; rua=mailto:x@y.fr"]],
      },
    });
    const r = await buildDeliverabilityReport(domain, dns);
    expect(r.score).toBe(100);
    expect(r.checks.every((c) => c.status === "ok")).toBe(true);
  });

  it("DMARC p=none => warn (score réduit)", async () => {
    const domain = "kado-pro.fr";
    const dns = fakeDns({
      mx: [{ exchange: "mx1.ovh.net", priority: 1 }],
      txt: {
        [domain]: [["v=spf1 ~all"]],
        [`ovhmx1._domainkey.${domain}`]: [["v=DKIM1; p=ABC"]],
        [`_dmarc.${domain}`]: [["v=DMARC1; p=none"]],
      },
    });
    const r = await buildDeliverabilityReport(domain, dns);
    const dmarc = r.checks.find((c) => c.key === "dmarc");
    expect(dmarc?.status).toBe("warn");
    expect(r.score).toBeLessThan(100);
  });

  it("tout absent => fails MX/SPF/DMARC, warn DKIM, score bas", async () => {
    const r = await buildDeliverabilityReport("exemple.fr", fakeDns({}));
    const byKey = Object.fromEntries(r.checks.map((c) => [c.key, c.status]));
    expect(byKey.mx).toBe("fail");
    expect(byKey.spf).toBe("fail");
    expect(byKey.dkim).toBe("warn");
    expect(byKey.dmarc).toBe("fail");
    expect(r.score).toBeLessThanOrEqual(15);
  });

  it("plusieurs SPF => warn", async () => {
    const domain = "exemple.fr";
    const dns = fakeDns({
      mx: [{ exchange: "mx", priority: 1 }],
      txt: {
        [domain]: [["v=spf1 a ~all"], ["v=spf1 include:x ~all"]],
      },
    });
    const r = await buildDeliverabilityReport(domain, dns);
    expect(r.checks.find((c) => c.key === "spf")?.status).toBe("warn");
  });
});
