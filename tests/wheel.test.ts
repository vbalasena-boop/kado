import { describe, it, expect } from "vitest";
import {
  sanitizeTriggerActions,
  isTriggerActionAllowed,
  shouldShowReviewCta,
  reviewCtaHref,
  TRIGGER_ACTIONS,
} from "@/lib/wheel";

describe("sanitizeTriggerActions", () => {
  it("conserve une liste valide", () => {
    expect(sanitizeTriggerActions(["instagram", "optin"])).toEqual([
      "instagram",
      "optin",
    ]);
  });

  it("filtre les valeurs inconnues (dont l'avis)", () => {
    expect(sanitizeTriggerActions(["instagram", "review", "x"])).toEqual([
      "instagram",
    ]);
  });

  it("garde-fou : liste vide → repli instagram", () => {
    expect(sanitizeTriggerActions([])).toEqual(["instagram"]);
  });

  it("non-tableau → repli instagram", () => {
    expect(sanitizeTriggerActions(null)).toEqual(["instagram"]);
    expect(sanitizeTriggerActions(undefined)).toEqual(["instagram"]);
    expect(sanitizeTriggerActions("x")).toEqual(["instagram"]);
  });

  it("déduplique en conservant l'ordre", () => {
    expect(sanitizeTriggerActions(["optin", "optin"])).toEqual(["optin"]);
  });

  it("conserve une seule action non-instagram", () => {
    expect(sanitizeTriggerActions(["loyalty"])).toEqual(["loyalty"]);
  });

  it("dédup + valeurs inconnues mêlées → ordre de première apparition", () => {
    expect(
      sanitizeTriggerActions(["optin", "review", "instagram", "optin"])
    ).toEqual(["optin", "instagram"]);
  });

  it("filtre les entrées non-string (nombres, objets, null)", () => {
    expect(
      sanitizeTriggerActions([1, "instagram", {}, null, "optin"])
    ).toEqual(["instagram", "optin"]);
  });

  it("accepte les trois actions autorisées", () => {
    expect(sanitizeTriggerActions(["instagram", "loyalty", "optin"])).toEqual([
      "instagram",
      "loyalty",
      "optin",
    ]);
    expect(TRIGGER_ACTIONS).toEqual(["instagram", "loyalty", "optin"]);
  });

  it("l'avis n'est jamais une action déclenchante", () => {
    expect(sanitizeTriggerActions(["review"])).toEqual(["instagram"]);
    expect(TRIGGER_ACTIONS).not.toContain("review");
  });
});

describe("isTriggerActionAllowed", () => {
  it("action configurée → true", () => {
    expect(isTriggerActionAllowed("instagram", ["instagram", "loyalty"])).toBe(
      true
    );
    expect(isTriggerActionAllowed("loyalty", ["instagram", "loyalty"])).toBe(
      true
    );
  });

  it("action non configurée → false", () => {
    expect(isTriggerActionAllowed("optin", ["instagram"])).toBe(false);
  });

  it("avis toujours refusé, même avec toutes les actions", () => {
    expect(
      isTriggerActionAllowed("review", ["instagram", "loyalty", "optin"])
    ).toBe(false);
  });

  it("colonne absente (tolérant) → repli instagram autorisé", () => {
    expect(isTriggerActionAllowed("instagram", undefined)).toBe(true);
    expect(isTriggerActionAllowed("instagram", null)).toBe(true);
    // mais une autre action reste refusée sous le repli
    expect(isTriggerActionAllowed("loyalty", undefined)).toBe(false);
  });

  it("liste vide (garde-fou) → repli instagram", () => {
    expect(isTriggerActionAllowed("loyalty", [])).toBe(false);
    expect(isTriggerActionAllowed("instagram", [])).toBe(true);
  });

  it("playType non-string → false", () => {
    expect(isTriggerActionAllowed(undefined, ["instagram"])).toBe(false);
    expect(isTriggerActionAllowed(42, ["instagram"])).toBe(false);
  });

  it("valeur inconnue → false (jamais dans TRIGGER_ACTIONS)", () => {
    expect(isTriggerActionAllowed("banana", ["instagram", "loyalty"])).toBe(
      false
    );
  });
});

describe("shouldShowReviewCta", () => {
  it("CTA affiché : activé + lien présent → true", () => {
    expect(
      shouldShowReviewCta({
        review_enabled: true,
        review_url: "https://g.page/r/x",
      })
    ).toBe(true);
  });

  it("lien absent (null) → masqué", () => {
    expect(
      shouldShowReviewCta({ review_enabled: true, review_url: null })
    ).toBe(false);
  });

  it("lien vide ('' / espaces) → masqué", () => {
    expect(
      shouldShowReviewCta({ review_enabled: true, review_url: "" })
    ).toBe(false);
    expect(
      shouldShowReviewCta({ review_enabled: true, review_url: "   " })
    ).toBe(false);
  });

  it("désactivé par le commerçant → masqué (même avec un lien)", () => {
    expect(
      shouldShowReviewCta({
        review_enabled: false,
        review_url: "https://g.page/r/x",
      })
    ).toBe(false);
  });

  it("défaut tolérant : enabled absent + lien → true (!== false)", () => {
    expect(shouldShowReviewCta({ review_url: "https://g.page/r/x" })).toBe(
      true
    );
  });

  it("enabled absent + lien absent → false", () => {
    expect(shouldShowReviewCta({})).toBe(false);
    expect(shouldShowReviewCta({ review_url: null })).toBe(false);
  });

  it("review_enabled null (valeur DB) → défaut tolérant : affiché si lien", () => {
    expect(
      shouldShowReviewCta({ review_enabled: null, review_url: "https://g.page/r/x" })
    ).toBe(true);
    expect(shouldShowReviewCta({ review_enabled: null, review_url: null })).toBe(
      false
    );
  });

  it("aucun review gating : la note/satisfaction n'est pas une entrée", () => {
    // La signature n'accepte que {review_enabled, review_url}. Un champ de note
    // éventuel est ignoré : la décision ne dépend jamais de la satisfaction.
    expect(
      shouldShowReviewCta({
        review_enabled: true,
        review_url: "https://g.page/r/x",
        // @ts-expect-error — aucun paramètre de note n'est accepté
        rating: 1,
      })
    ).toBe(true);
  });
});

describe("reviewCtaHref", () => {
  it("URL http(s) conservée telle quelle", () => {
    expect(reviewCtaHref({ review_url: "https://g.page/r/x" })).toBe(
      "https://g.page/r/x"
    );
    expect(reviewCtaHref({ review_url: "http://g.page/r/x" })).toBe(
      "http://g.page/r/x"
    );
  });

  it("domaine/chemin nu (sans schéma) → normalisé en https://", () => {
    expect(reviewCtaHref({ review_url: "g.page/r/x" })).toBe(
      "https://g.page/r/x"
    );
    expect(reviewCtaHref({ review_url: "www.google.com/avis" })).toBe(
      "https://www.google.com/avis"
    );
  });

  it("espaces autour du lien → trim", () => {
    expect(reviewCtaHref({ review_url: "  https://g.page/r/x  " })).toBe(
      "https://g.page/r/x"
    );
  });

  it("schéma hostile (javascript:/data:/mailto:) → null (anti-XSS)", () => {
    expect(reviewCtaHref({ review_url: "javascript:alert(1)" })).toBeNull();
    expect(reviewCtaHref({ review_url: "data:text/html,x" })).toBeNull();
    expect(reviewCtaHref({ review_url: "mailto:x@y.z" })).toBeNull();
  });

  it("désactivé / absent / vide → null", () => {
    expect(
      reviewCtaHref({ review_enabled: false, review_url: "https://g.page/r/x" })
    ).toBeNull();
    expect(reviewCtaHref({ review_url: "" })).toBeNull();
    expect(reviewCtaHref({ review_url: "   " })).toBeNull();
    expect(reviewCtaHref({})).toBeNull();
  });
});
