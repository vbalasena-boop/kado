import { describe, it, expect } from "vitest";
import { escapeHtml, buildCampaignPayloads } from "@/lib/campaigns";

process.env.PLAYER_COOKIE_SECRET = "test-secret-campaigns";

describe("escapeHtml", () => {
  it("échappe les chevrons et l'esperluette (contenu texte)", () => {
    expect(escapeHtml("a & b < c > d")).toBe("a &amp; b &lt; c &gt; d");
    expect(escapeHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;"
    );
  });

  it("échappe aussi les guillemets → sûr en contexte d'attribut", () => {
    expect(escapeHtml('" onmouseover="x')).toBe("&quot; onmouseover=&quot;x");
    expect(escapeHtml("O'Brien")).toBe("O&#39;Brien");
  });

  it("laisse le texte simple intact", () => {
    expect(escapeHtml("Promo été 🌞")).toBe("Promo été 🌞");
  });
});

describe("buildCampaignPayloads — anti-injection du sujet", () => {
  const business = { id: "biz-1", name: "Chez Léa", slug: "chez-lea" };

  it("échappe le sujet réinjecté dans le titre/aperçu HTML", () => {
    const [payload] = buildCampaignPayloads(
      business,
      undefined,
      `</h1><img src=x onerror="alert(1)">`,
      "Bonjour !",
      ["client@example.com"]
    );
    // Le HTML ne doit PAS contenir la balise <img> brute ni onerror exécutable.
    expect(payload.html).not.toContain("<img src=x onerror=");
    expect(payload.html).toContain("&lt;img src=x onerror=");
    // Le champ d'en-tête `subject` reste brut (ce n'est pas du HTML).
    expect(payload.subject).toBe(`</h1><img src=x onerror="alert(1)">`);
  });

  it("échappe le nom du commerce réinjecté dans le HTML", () => {
    const [payload] = buildCampaignPayloads(
      { id: "b", name: `<b>x</b>`, slug: "s" },
      undefined,
      "Sujet",
      "Corps",
      ["a@b.com"]
    );
    expect(payload.html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});
