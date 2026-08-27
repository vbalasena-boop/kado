import { describe, it, expect } from "vitest";
import { htmlToText } from "@/lib/prospection/site-excerpt";

describe("htmlToText", () => {
  it("récupère le titre, la meta description et le texte", () => {
    const html =
      `<html><head><title>Café du Coin</title>` +
      `<meta name="description" content="Brunch et café de spécialité à Versailles"></head>` +
      `<body><script>var x=1;</script><style>.a{}</style>` +
      `<h1>Bienvenue</h1><p>Notre carte change chaque semaine.</p></body></html>`;
    const out = htmlToText(html);
    expect(out).toContain("Café du Coin");
    expect(out).toContain("Brunch et café de spécialité");
    expect(out).toContain("Notre carte change chaque semaine");
    // scripts/styles retirés
    expect(out).not.toContain("var x");
    expect(out).not.toContain(".a{}");
  });

  it("décode les entités et normalise les espaces", () => {
    const out = htmlToText("<p>Th&eacute;   &amp;   caf&eacute;</p>");
    expect(out).toContain("Thé & café");
  });

  it("gère un HTML vide", () => {
    expect(htmlToText("")).toBe("");
  });
});
