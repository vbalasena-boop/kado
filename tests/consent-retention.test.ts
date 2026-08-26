import { describe, it, expect } from "vitest";
import {
  consentIdsToPurge,
  CONSENT_RETENTION_DAYS,
  type ConsentEventLike,
} from "@/lib/consent-retention";

// « Maintenant » fixe pour des tests déterministes.
const NOW = Date.parse("2026-08-26T00:00:00Z");
const daysAgo = (n: number) =>
  new Date(NOW - n * 86_400_000).toISOString();

function ev(
  id: string,
  business_id: string,
  email: string,
  ageDays: number
): ConsentEventLike {
  return { id, business_id, email, created_at: daysAgo(ageDays) };
}

describe("consentIdsToPurge", () => {
  it("ne purge rien si tout est dans la fenêtre de rétention", () => {
    const events = [
      ev("a", "b1", "x@y.z", 10),
      ev("b", "b1", "x@y.z", 400),
    ];
    expect(consentIdsToPurge(events, CONSENT_RETENTION_DAYS, NOW)).toEqual([]);
  });

  it("purge un événement ancien REMPLACÉ par un plus récent du même sujet", () => {
    const events = [
      ev("old", "b1", "x@y.z", 1500), // > 3 ans, remplacé
      ev("recent", "b1", "x@y.z", 10), // dernier état
    ];
    expect(consentIdsToPurge(events, CONSENT_RETENTION_DAYS, NOW)).toEqual(["old"]);
  });

  it("ne purge JAMAIS le dernier événement d'un sujet, même > 3 ans", () => {
    const events = [
      ev("only", "b1", "x@y.z", 2000), // seul événement, très vieux
    ];
    expect(consentIdsToPurge(events, CONSENT_RETENTION_DAYS, NOW)).toEqual([]);
  });

  it("garde le dernier état même quand plusieurs anciens existent", () => {
    const events = [
      ev("e1", "b1", "x@y.z", 2200),
      ev("e2", "b1", "x@y.z", 1600),
      ev("e3", "b1", "x@y.z", 1200), // dernier, mais > 3 ans (1095 j) → gardé
    ];
    // e3 est le plus récent → conservé ; e1 et e2 purgés.
    expect(consentIdsToPurge(events, CONSENT_RETENTION_DAYS, NOW).sort()).toEqual([
      "e1",
      "e2",
    ]);
  });

  it("isole les sujets (business_id + email)", () => {
    const events = [
      // sujet A : un ancien remplacé + un récent
      ev("a-old", "b1", "x@y.z", 1500),
      ev("a-new", "b1", "x@y.z", 5),
      // sujet B : même e-mail, autre commerce → ancien mais SEUL → gardé
      ev("b-only", "b2", "x@y.z", 1500),
      // sujet C : même commerce, autre e-mail → ancien mais SEUL → gardé
      ev("c-only", "b1", "autre@y.z", 1500),
    ];
    expect(consentIdsToPurge(events, CONSENT_RETENTION_DAYS, NOW)).toEqual(["a-old"]);
  });

  it("conserve les deux si deux événements sont à égalité au plus récent", () => {
    const events = [
      ev("tie1", "b1", "x@y.z", 1500),
      ev("tie2", "b1", "x@y.z", 1500),
    ];
    // Aucun n'est strictement plus récent que l'autre → rien à purger.
    expect(consentIdsToPurge(events, CONSENT_RETENTION_DAYS, NOW)).toEqual([]);
  });

  it("la borne est exclusive : pile à 3 ans (dans la fenêtre) → conservé", () => {
    const events = [
      ev("edge", "b1", "x@y.z", CONSENT_RETENTION_DAYS), // created_at == cutoff
      ev("newer", "b1", "x@y.z", 1),
    ];
    // edge.created_at === cutoff → t >= cutoff → conservé (pas purgé).
    expect(consentIdsToPurge(events, CONSENT_RETENTION_DAYS, NOW)).toEqual([]);
  });
});
