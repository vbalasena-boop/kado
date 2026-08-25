import { describe, it, expect } from "vitest";
import {
  reviewHook,
  renderEmail,
  renderFollowupEmail,
  renderDm,
  emailSubjectVariant,
  SUBJECT_VARIANTS,
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
    expect(reviewHook(200)).toContain("déjà 200");
    expect(reviewHook(null)).toBe("vous êtes présent sur Google");
    // toujours une proposition (commence par "vous")
    for (const c of [null, 0, 12, 200] as const) {
      expect(reviewHook(c).startsWith("vous")).toBe(true);
    }
  });
});

describe("renderEmail", () => {
  it("personnalise l'objet et le corps (invariants)", () => {
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

  it("varie le message selon le prospect (anti-bulk)", () => {
    const a = renderEmail(ctx({ name: "Resto A", seed: "id-a" }));
    const b = renderEmail(ctx({ name: "Resto B", seed: "id-b-xyz" }));
    // deux prospects différents → contenus différents
    expect(a.body).not.toBe(b.body);
  });

  it("est stable pour un même prospect (même seed → même message)", () => {
    const a = renderEmail(ctx({ seed: "stable-1" }));
    const b = renderEmail(ctx({ seed: "stable-1" }));
    expect(a.subject).toBe(b.subject);
    expect(a.body).toBe(b.body);
  });
});

describe("emailSubjectVariant (mesure par objet)", () => {
  it("renvoie un index stable dans la plage des variantes", () => {
    for (const seed of ["id-a", "id-b", "prospect-123"]) {
      const idx = emailSubjectVariant(seed);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(SUBJECT_VARIANTS.length);
      expect(emailSubjectVariant(seed)).toBe(idx); // déterministe
    }
  });

  it("correspond à l'objet réellement rendu (attribution correcte)", () => {
    const seed = "prospect-xyz";
    const expected = SUBJECT_VARIANTS[emailSubjectVariant(seed)].replace("{name}", "BONNIE");
    const { subject } = renderEmail(ctx({ name: "BONNIE", seed }));
    expect(subject).toBe(expected);
  });
});

describe("renderDm", () => {
  it("génère un DM court et personnalisé", () => {
    const dm = renderDm(ctx({ name: "La Tanière", google_reviews_count: 74 }));
    expect(dm).toContain("La Tanière");
    expect(dm).toContain("74");
  });

  it("ne colle JAMAIS le lien de réservation dans le DM (protection compte)", () => {
    const url = "https://cal.com/kado/10min";
    const dm = renderDm(ctx({ name: "La Tanière", bookingUrl: url }));
    expect(dm).not.toContain(url);
    expect(dm).not.toMatch(/https?:\/\//);
  });
});

describe("RDV téléphonique (lien de réservation)", () => {
  it("insère le lien de réservation dans l'email quand il est fourni", () => {
    const url = "https://cal.com/kado/10min";
    const { body } = renderEmail(ctx({ bookingUrl: url }));
    expect(body).toContain(url);
    // spamCheck : un seul lien cliquable + désinscription → non risqué.
    const { subject, body: b2 } = renderEmail(ctx({ bookingUrl: url }));
    expect(spamCheck(`${subject}\n${b2}`).risky).toBe(false);
  });

  it("propose un rappel « par réponse » sans lien quand aucun lien n'est fourni", () => {
    const { body } = renderEmail(ctx({ bookingUrl: "" }));
    // Aucun lien http (hors marqueur de désinscription {{unsubscribe_url}}).
    expect(body).not.toMatch(/https?:\/\//);
    expect(body).toContain(UNSUBSCRIBE_MARKER);
  });

  it("insère le lien dans la relance quand il est fourni", () => {
    const url = "https://cal.com/kado/10min";
    const { body } = renderFollowupEmail(ctx({ bookingUrl: url }));
    expect(body).toContain(url);
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
