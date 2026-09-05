import { describe, it, expect } from "vitest";
import {
  sanitizeTriggerActions,
  unlockedSpinActions,
  isTriggerActionAllowed,
  isTriggerActionSelectable,
  resolveTriggerActions,
  nextTriggerActions,
  shouldShowReviewCta,
  reviewCtaHref,
  instagramHref,
  avisMigrationNoticeNeeded,
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

describe("unlockedSpinActions", () => {
  it("carte active → « loyalty » conservée", () => {
    expect(
      unlockedSpinActions(["instagram", "loyalty"], { loyaltyEnabled: true })
    ).toEqual(["instagram", "loyalty"]);
  });

  it("carte désactivée → « loyalty » retirée", () => {
    expect(
      unlockedSpinActions(["instagram", "loyalty"], { loyaltyEnabled: false })
    ).toEqual(["instagram"]);
  });

  it("seulement loyalty + carte désactivée → repli instagram", () => {
    expect(unlockedSpinActions(["loyalty"], { loyaltyEnabled: false })).toEqual([
      "instagram",
    ]);
  });

  it("défaut (opts absent) → identique à sanitize (rétrocompat)", () => {
    expect(unlockedSpinActions(["loyalty"])).toEqual(["loyalty"]);
    expect(unlockedSpinActions(["instagram", "loyalty"])).toEqual([
      "instagram",
      "loyalty",
    ]);
  });

  it("loyaltyEnabled non passé dans opts → carte considérée active (rétrocompat)", () => {
    expect(unlockedSpinActions(["loyalty"], {})).toEqual(["loyalty"]);
  });

  it("normalise (avis filtré, non-tableau) comme sanitize", () => {
    expect(unlockedSpinActions(["review"], { loyaltyEnabled: false })).toEqual([
      "instagram",
    ]);
    expect(unlockedSpinActions(null, { loyaltyEnabled: true })).toEqual([
      "instagram",
    ]);
  });

  it("carte désactivée conserve les autres actions", () => {
    expect(
      unlockedSpinActions(["loyalty", "optin"], { loyaltyEnabled: false })
    ).toEqual(["optin"]);
  });

  it("sans lien Instagram → « instagram » retirée si une autre action reste", () => {
    expect(
      unlockedSpinActions(["instagram", "optin"], { instagramLinked: false })
    ).toEqual(["optin"]);
    expect(
      unlockedSpinActions(["instagram", "loyalty", "optin"], {
        loyaltyEnabled: true,
        instagramLinked: false,
      })
    ).toEqual(["loyalty", "optin"]);
  });

  it("sans lien Instagram mais action unique → conservée (jeu jamais vide)", () => {
    expect(
      unlockedSpinActions(["instagram"], { instagramLinked: false })
    ).toEqual(["instagram"]);
    // Repli après retrait de loyalty : instagram reste la seule action.
    expect(
      unlockedSpinActions(["instagram", "loyalty"], {
        loyaltyEnabled: false,
        instagramLinked: false,
      })
    ).toEqual(["instagram"]);
    expect(unlockedSpinActions(null, { instagramLinked: false })).toEqual([
      "instagram",
    ]);
  });

  it("lien Instagram présent (ou option absente) → aucun retrait", () => {
    expect(
      unlockedSpinActions(["instagram", "optin"], { instagramLinked: true })
    ).toEqual(["instagram", "optin"]);
    expect(unlockedSpinActions(["instagram", "optin"], {})).toEqual([
      "instagram",
      "optin",
    ]);
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

  it("loyalty + carte désactivée → false (filet de sécurité)", () => {
    expect(
      isTriggerActionAllowed("loyalty", ["loyalty"], { loyaltyEnabled: false })
    ).toBe(false);
    expect(
      isTriggerActionAllowed("loyalty", ["instagram", "loyalty"], {
        loyaltyEnabled: false,
      })
    ).toBe(false);
  });

  it("loyalty + carte active → true", () => {
    expect(
      isTriggerActionAllowed("loyalty", ["loyalty"], { loyaltyEnabled: true })
    ).toBe(true);
  });

  it("loyalty sans opts → true (rétrocompat, défaut activé)", () => {
    expect(isTriggerActionAllowed("loyalty", ["loyalty"])).toBe(true);
    expect(isTriggerActionAllowed("loyalty", ["loyalty"], {})).toBe(true);
  });

  it("sans lien Instagram → « instagram » refusée si une autre action reste", () => {
    expect(
      isTriggerActionAllowed("instagram", ["instagram", "optin"], {
        instagramLinked: false,
      })
    ).toBe(false);
    expect(
      isTriggerActionAllowed("optin", ["instagram", "optin"], {
        instagramLinked: false,
      })
    ).toBe(true);
  });

  it("sans lien Instagram mais action unique → autorisée (miroir du jeu)", () => {
    expect(
      isTriggerActionAllowed("instagram", ["instagram"], { instagramLinked: false })
    ).toBe(true);
    expect(
      isTriggerActionAllowed("instagram", ["loyalty"], {
        loyaltyEnabled: false,
        instagramLinked: false,
      })
    ).toBe(true);
  });

  it("instagram inchangé même si carte désactivée", () => {
    expect(
      isTriggerActionAllowed("instagram", ["instagram"], {
        loyaltyEnabled: false,
      })
    ).toBe(true);
  });

  it("review reste refusé quel que soit loyaltyEnabled", () => {
    expect(
      isTriggerActionAllowed("review", ["instagram", "loyalty"], {
        loyaltyEnabled: true,
      })
    ).toBe(false);
  });
});

describe("isTriggerActionSelectable", () => {
  it("Instagram toujours sélectionnable", () => {
    expect(
      isTriggerActionSelectable("instagram", { fideliteAvailable: false })
    ).toBe(true);
    expect(
      isTriggerActionSelectable("instagram", { fideliteAvailable: true })
    ).toBe(true);
  });

  it("Offres (optin) toujours sélectionnable", () => {
    expect(
      isTriggerActionSelectable("optin", { fideliteAvailable: false })
    ).toBe(true);
    expect(
      isTriggerActionSelectable("optin", { fideliteAvailable: true })
    ).toBe(true);
  });

  it("Fidélité sélectionnable ⟺ module disponible", () => {
    expect(
      isTriggerActionSelectable("loyalty", { fideliteAvailable: true })
    ).toBe(true);
    expect(
      isTriggerActionSelectable("loyalty", { fideliteAvailable: false })
    ).toBe(false);
  });

  it("valeur inconnue (dont l'avis) → false", () => {
    expect(
      isTriggerActionSelectable("review", { fideliteAvailable: true })
    ).toBe(false);
    expect(
      isTriggerActionSelectable("banana", { fideliteAvailable: true })
    ).toBe(false);
    expect(
      isTriggerActionSelectable(undefined, { fideliteAvailable: true })
    ).toBe(false);
    expect(
      isTriggerActionSelectable(null, { fideliteAvailable: true })
    ).toBe(false);
  });
});

describe("resolveTriggerActions", () => {
  it("purge « loyalty » quand le module fidélité est absent → repli si vide", () => {
    expect(
      resolveTriggerActions(["loyalty"], { fideliteAvailable: false })
    ).toEqual(["instagram"]);
    expect(
      resolveTriggerActions(["loyalty", "optin"], { fideliteAvailable: false })
    ).toEqual(["optin"]);
  });

  it("conserve « loyalty » quand le module est disponible", () => {
    expect(
      resolveTriggerActions(["instagram", "loyalty"], { fideliteAvailable: true })
    ).toEqual(["instagram", "loyalty"]);
  });

  it("normalise (avis filtré, repli) comme sanitize", () => {
    expect(
      resolveTriggerActions(["review"], { fideliteAvailable: true })
    ).toEqual(["instagram"]);
    expect(resolveTriggerActions(null, { fideliteAvailable: true })).toEqual([
      "instagram",
    ]);
  });
});

describe("nextTriggerActions", () => {
  it("ajoute une action en conservant l'ordre canonique", () => {
    expect(
      nextTriggerActions(["instagram"], "optin", { fideliteAvailable: true })
    ).toEqual(["instagram", "optin"]);
  });

  it("retire une action active", () => {
    expect(
      nextTriggerActions(["instagram", "optin"], "optin", {
        fideliteAvailable: true,
      })
    ).toEqual(["instagram"]);
  });

  it("refuse de retirer la dernière action", () => {
    expect(
      nextTriggerActions(["optin"], "optin", { fideliteAvailable: true })
    ).toEqual(["optin"]);
  });

  it("une action non sélectionnable ne change rien (et purge l'existant verrouillé)", () => {
    // loyalty verrouillée : le toggle est un no-op et le set effectif la purge
    expect(
      nextTriggerActions(["instagram", "loyalty"], "loyalty", {
        fideliteAvailable: false,
      })
    ).toEqual(["instagram"]);
    // id non-string → no-op (set effectif renvoyé)
    expect(
      nextTriggerActions(["instagram"], null, { fideliteAvailable: true })
    ).toEqual(["instagram"]);
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

describe("instagramHref (anti-XSS, ouvert via window.open côté joueur)", () => {
  it("URL http(s) conservée ; schéma nu → https://", () => {
    expect(instagramHref({ instagram_url: "https://instagram.com/cafe" })).toBe(
      "https://instagram.com/cafe"
    );
    expect(instagramHref({ instagram_url: "instagram.com/cafe" })).toBe(
      "https://instagram.com/cafe"
    );
  });

  it("schéma hostile → null (le cœur du correctif S1)", () => {
    expect(instagramHref({ instagram_url: "javascript:alert(document.cookie)" })).toBeNull();
    expect(instagramHref({ instagram_url: "data:text/html,<script>1</script>" })).toBeNull();
    expect(instagramHref({ instagram_url: "  JavaScript:alert(1)" })).toBeNull();
  });

  it("absent / vide / non-string → null", () => {
    expect(instagramHref({})).toBeNull();
    expect(instagramHref({ instagram_url: "" })).toBeNull();
    expect(instagramHref({ instagram_url: 42 as any })).toBeNull();
  });
});

describe("avisMigrationNoticeNeeded", () => {
  it("concerné : avis actif + lien renseigné → true", () => {
    expect(
      avisMigrationNoticeNeeded({
        review_enabled: true,
        review_url: "https://g.page/r/x",
      })
    ).toBe(true);
  });

  it("avis désactivé (même avec un lien) → false", () => {
    expect(
      avisMigrationNoticeNeeded({
        review_enabled: false,
        review_url: "https://g.page/r/x",
      })
    ).toBe(false);
  });

  it("pas de lien avis (null / '' / espaces) → false", () => {
    expect(
      avisMigrationNoticeNeeded({ review_enabled: true, review_url: null })
    ).toBe(false);
    expect(
      avisMigrationNoticeNeeded({ review_enabled: true, review_url: "" })
    ).toBe(false);
    expect(
      avisMigrationNoticeNeeded({ review_enabled: true, review_url: "   " })
    ).toBe(false);
  });

  it("défaut tolérant : enabled absent + lien → true (!== false)", () => {
    expect(
      avisMigrationNoticeNeeded({ review_url: "https://g.page/r/x" })
    ).toBe(true);
    expect(
      avisMigrationNoticeNeeded({ review_enabled: null, review_url: "g.page/r/x" })
    ).toBe(true);
  });

  it("enabled absent + lien absent → false", () => {
    expect(avisMigrationNoticeNeeded({})).toBe(false);
    expect(avisMigrationNoticeNeeded({ review_url: null })).toBe(false);
  });

  it("aucune entrée de note : la décision ne dépend d'aucune satisfaction", () => {
    expect(
      avisMigrationNoticeNeeded({
        review_enabled: true,
        review_url: "https://g.page/r/x",
        // @ts-expect-error — aucun paramètre de note n'est accepté
        rating: 1,
      })
    ).toBe(true);
  });
});
