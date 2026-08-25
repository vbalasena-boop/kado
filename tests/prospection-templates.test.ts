import { describe, it, expect } from "vitest";
import {
  reviewHook,
  renderEmail,
  renderDm,
  UNSUBSCRIBE_MARKER,
  type TemplateContext,
} from "@/lib/prospection/templates";
import { spamCheck } from "@/lib/prospection/spam";

function ctx(over: Partial<TemplateContext> = {}): TemplateContext {
  return {
    name: "BONNIE",
    city: "Versailles",
    category: "resto",
    google_reviews_count: 29,
    ...over,
  };
}

describe("reviewHook", () => {
  it("adapte l'accroche au nombre d'avis", () => {
    expect(reviewHook(0)).toContain("pas encore");
    expect(reviewHook(12)).toContain("seulement 12");
    expect(reviewHook(200)).toContain("200");
    expect(reviewHook(null)).toBe("vos avis Google");
  });
});

describe("renderEmail", () => {
  it("personnalise l'objet et le corps", () => {
    const { subject, body } = renderEmail(ctx({ name: "BONNIE", google_reviews_count: 29 }));
    expect(subject).toContain("BONNIE");
    expect(body).toContain("BONNIE");
    expect(body).toContain("Versailles");
    expect(body).toContain("29 avis");
  });

  it("inclut toujours le marqueur de désinscription", () => {
    const { body } = renderEmail(ctx());
    expect(body).toContain(UNSUBSCRIBE_MARKER);
  });

  it("adapte le nom du commerce au segment", () => {
    expect(renderEmail(ctx({ category: "beaute" })).body).toContain("salon");
    expect(renderEmail(ctx({ category: "boutique" })).body).toContain("boutique");
  });
});

describe("renderDm", () => {
  it("génère un DM court et personnalisé", () => {
    const dm = renderDm(ctx({ name: "La Tanière", google_reviews_count: 74 }));
    expect(dm).toContain("La Tanière");
    expect(dm).toContain("74");
  });
});

describe("spamCheck", () => {
  it("ne signale rien sur un email Kado normal", () => {
    const { subject, body } = renderEmail(ctx());
    const res = spamCheck(`${subject}\n${body}`);
    expect(res.risky).toBe(false);
  });

  it("détecte les mots déclencheurs", () => {
    const res = spamCheck("GAGNEZ de l'argent gratuit, offre limitée !!!");
    expect(res.risky).toBe(true);
    expect(res.flags.length).toBeGreaterThan(0);
  });

  it("détecte l'excès de majuscules et de ponctuation", () => {
    const res = spamCheck("URGENT PROMO SUPER OFFRE!!!!");
    expect(res.risky).toBe(true);
  });
});
