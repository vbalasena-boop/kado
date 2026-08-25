import { describe, it, expect } from "vitest";
import { scoreProspect, type ScoreInput } from "@/lib/prospection/score";

const NOW = new Date("2026-08-25T00:00:00Z");

function input(over: Partial<ScoreInput> = {}): ScoreInput {
  return {
    google_reviews_count: 100,
    google_rating: 4.6,
    google_last_review_at: "2026-08-01",
    instagram_active: false,
    email: null,
    ...over,
  };
}

describe("scoreProspect", () => {
  it("donne un score plus élevé à un commerce avec peu d'avis", () => {
    const few = scoreProspect(input({ google_reviews_count: 5 }), NOW);
    const many = scoreProspect(input({ google_reviews_count: 190 }), NOW);
    expect(few.score).toBeGreaterThan(many.score);
  });

  it("reste borné entre 0 et 100", () => {
    const best = scoreProspect(
      {
        google_reviews_count: 0,
        google_rating: 4.0,
        google_last_review_at: "2020-01-01",
        instagram_active: true,
        email: "a@b.fr",
      },
      NOW
    );
    expect(best.score).toBeGreaterThan(0);
    expect(best.score).toBeLessThanOrEqual(100);
  });

  it("valorise une note perfectible plus qu'une note déjà excellente", () => {
    const improvable = scoreProspect(input({ google_rating: 3.9 }), NOW);
    const excellent = scoreProspect(input({ google_rating: 4.9 }), NOW);
    expect(improvable.score).toBeGreaterThan(excellent.score);
  });

  it("bonus de fraîcheur si aucun avis depuis 6 mois", () => {
    const stale = scoreProspect(input({ google_last_review_at: "2025-01-01" }), NOW);
    const fresh = scoreProspect(input({ google_last_review_at: "2026-08-20" }), NOW);
    expect(stale.score).toBeGreaterThan(fresh.score);
  });

  it("bonus Instagram actif et email présent", () => {
    const rich = scoreProspect(input({ instagram_active: true, email: "x@y.fr" }), NOW);
    const poor = scoreProspect(input({ instagram_active: false, email: null }), NOW);
    expect(rich.score).toBeGreaterThan(poor.score);
  });

  it("le score est explicable (5 facteurs)", () => {
    const r = scoreProspect(input(), NOW);
    expect(r.factors).toHaveLength(5);
    expect(r.factors.map((f) => f.key).sort()).toEqual([
      "contact",
      "freshness",
      "instagram",
      "rating",
      "reviews",
    ]);
    for (const f of r.factors) expect(f.reason.length).toBeGreaterThan(0);
  });

  it("gère les signaux inconnus (null) sans planter", () => {
    const r = scoreProspect(
      {
        google_reviews_count: null,
        google_rating: null,
        google_last_review_at: null,
        instagram_active: null,
        email: null,
      },
      NOW
    );
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});
