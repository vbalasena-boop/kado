import { describe, it, expect } from "vitest";
import { draftReviewReply } from "@/lib/review-reply";

describe("draftReviewReply", () => {
  it("avis négatif, ton sobre, prénom → excuse + invitation à résoudre + signature", () => {
    const out = draftReviewReply({
      shopName: "Chez Léa",
      kind: "negatif",
      tone: "sobre",
      authorName: "Marc",
    });
    expect(out.startsWith("Bonjour Marc,")).toBe(true);
    expect(out).toContain("navrés");
    expect(out).toContain("contacter directement");
    expect(out.trim().endsWith("L'équipe de Chez Léa")).toBe(true);
  });

  it("avis positif, ton chaleureux → remerciement chaleureux + invitation à revenir", () => {
    const out = draftReviewReply({
      shopName: "Chez Léa",
      kind: "positif",
      tone: "chaleureux",
    });
    expect(out).toContain("chaud au cœur");
    expect(out).toContain("revoir");
    expect(out).toContain("Bien chaleureusement,");
  });

  it("avis mitigé → remercie + prend note + amélioration", () => {
    const out = draftReviewReply({ shopName: "Chez Léa", kind: "mitige" });
    expect(out).toContain("prenons note");
    expect(out).toContain("amélior");
  });

  it("sans prénom → salutation générique", () => {
    const out = draftReviewReply({ shopName: "Chez Léa", kind: "negatif" });
    expect(out.startsWith("Bonjour,")).toBe(true);
  });

  it("shopName vide → signature de repli, aucun plantage", () => {
    const out = draftReviewReply({ shopName: "", kind: "positif" });
    expect(out.trim().endsWith("L'équipe")).toBe(true);
  });

  it("prénom avec balises → chevrons retirés (pas de HTML)", () => {
    const out = draftReviewReply({
      shopName: "X",
      kind: "mitige",
      authorName: "<b>Jo</b>",
    });
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out.startsWith("Bonjour bJo/b,")).toBe(true);
  });
});
