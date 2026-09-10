import { describe, it, expect } from "vitest";
import {
  cleanHost,
  isKadoHost,
  normalizeOrderDomain,
  normalizeWebsiteUrl,
  rewritePathForOrderHost,
  websiteLabel,
} from "@/lib/order-domain";

describe("normalizeOrderDomain", () => {
  it("nettoie protocole, chemin, port, majuscules", () => {
    expect(normalizeOrderDomain(" HTTPS://Commander.Qustos.fr/ ")).toBe(
      "commander.qustos.fr"
    );
    expect(normalizeOrderDomain("commander.qustos.fr:443/menu?x=1")).toBe(
      "commander.qustos.fr"
    );
    expect(normalizeOrderDomain("commander.qustos.fr.")).toBe(
      "commander.qustos.fr"
    );
  });
  it("refuse les valeurs invalides", () => {
    expect(normalizeOrderDomain("")).toBeNull();
    expect(normalizeOrderDomain("qustos")).toBeNull();
    expect(normalizeOrderDomain("-bad.fr")).toBeNull();
    expect(normalizeOrderDomain("a b.fr")).toBeNull();
    expect(normalizeOrderDomain(42)).toBeNull();
  });
  it("refuse les hôtes Kado (impossible de détourner kado-app.fr)", () => {
    expect(normalizeOrderDomain("kado-app.fr")).toBeNull();
    expect(normalizeOrderDomain("x.kado-app.fr")).toBeNull();
    expect(normalizeOrderDomain("kado-kado8.vercel.app")).toBeNull();
  });
});

describe("isKadoHost / cleanHost", () => {
  it("reconnaît l'infrastructure Kado", () => {
    expect(isKadoHost("kado-app.fr")).toBe(true);
    expect(isKadoHost("www.kado-app.fr")).toBe(true);
    expect(isKadoHost("kado-git-x-kado8.vercel.app")).toBe(true);
    expect(isKadoHost("localhost:3000")).toBe(true);
    expect(isKadoHost("commander.qustos.fr")).toBe(false);
    expect(isKadoHost("kado-app.fr.evil.com")).toBe(false);
  });
  it("cleanHost enlève port et espaces", () => {
    expect(cleanHost(" Commander.Qustos.fr:443 ")).toBe("commander.qustos.fr");
    expect(cleanHost("a.fr, b.fr")).toBe("a.fr");
    expect(cleanHost(null)).toBe("");
  });
});

describe("rewritePathForOrderHost", () => {
  const slug = "qustos";
  it("la racine et /commander → la page de commande du commerce", () => {
    expect(rewritePathForOrderHost("/", slug)).toBe("/qustos/commander");
    expect(rewritePathForOrderHost("/commander/", slug)).toBe(
      "/qustos/commander"
    );
  });
  it("/suivi/<code> → suivi du commerce", () => {
    expect(rewritePathForOrderHost("/suivi/AB12", slug)).toBe(
      "/qustos/suivi/AB12"
    );
  });
  it("laisse passer API, assets et chemins déjà préfixés", () => {
    expect(rewritePathForOrderHost("/api/order", slug)).toBeNull();
    expect(rewritePathForOrderHost("/_next/static/x.js", slug)).toBeNull();
    expect(rewritePathForOrderHost("/sw.js", slug)).toBeNull();
    expect(rewritePathForOrderHost("/icon-192.png", slug)).toBeNull();
    expect(rewritePathForOrderHost("/qustos/suivi/AB12", slug)).toBeNull();
    expect(rewritePathForOrderHost("/qustos/commander", slug)).toBeNull();
  });
  it("tout autre chemin ramène à la commande (pas de fuite du site Kado)", () => {
    expect(rewritePathForOrderHost("/tarifs", slug)).toBe("/qustos/commander");
    expect(rewritePathForOrderHost("/dashboard/orders", slug)).toBe(
      "/qustos/commander"
    );
    expect(rewritePathForOrderHost("/autre-slug/commander", slug)).toBe(
      "/qustos/commander"
    );
  });
});

describe("normalizeWebsiteUrl / websiteLabel", () => {
  it("ajoute https:// et valide", () => {
    expect(normalizeWebsiteUrl("qustos.fr")).toBe("https://qustos.fr/");
    expect(normalizeWebsiteUrl("https://www.qustos.fr/menu")).toBe(
      "https://www.qustos.fr/menu"
    );
  });
  it("refuse les schémas dangereux et les valeurs vides", () => {
    expect(normalizeWebsiteUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeWebsiteUrl("")).toBeNull();
    expect(normalizeWebsiteUrl("pasdedomaine")).toBeNull();
  });
  it("websiteLabel donne l'hôte sans www", () => {
    expect(websiteLabel("https://www.qustos.fr/menu")).toBe("qustos.fr");
  });
});
