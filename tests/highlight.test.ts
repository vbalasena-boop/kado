import { describe, it, expect } from "vitest";
import { visibleHighlight } from "@/lib/highlight";

const TODAY = "2026-08-26";

describe("visibleHighlight", () => {
  it("null si config absente ou vide", () => {
    expect(visibleHighlight(null, TODAY)).toBeNull();
    expect(visibleHighlight({}, TODAY)).toBeNull();
    expect(
      visibleHighlight({ highlight_title: "   ", highlight_text: "" }, TODAY)
    ).toBeNull();
  });

  it("affiche si titre OU message présent", () => {
    expect(
      visibleHighlight({ highlight_title: "Menu du jour" }, TODAY)
    ).toEqual({ title: "Menu du jour", text: "", url: null });
    expect(
      visibleHighlight({ highlight_text: "Tarte aux pommes" }, TODAY)
    ).toEqual({ title: "", text: "Tarte aux pommes", url: null });
  });

  it("nettoie les espaces", () => {
    const h = visibleHighlight(
      { highlight_title: "  Événement  ", highlight_text: "  samedi  " },
      TODAY
    );
    expect(h).toEqual({ title: "Événement", text: "samedi", url: null });
  });

  it("durcit l'URL (anti-XSS) et préfixe https", () => {
    expect(
      visibleHighlight(
        { highlight_title: "x", highlight_url: "javascript:alert(1)" },
        TODAY
      )?.url
    ).toBeNull();
    expect(
      visibleHighlight(
        { highlight_title: "x", highlight_url: "instagram.com/kado" },
        TODAY
      )?.url
    ).toBe("https://instagram.com/kado");
  });

  it("expiration : masqué le lendemain de la date de fin, visible le jour même", () => {
    // date de fin = hier → masqué
    expect(
      visibleHighlight(
        { highlight_title: "x", highlight_until: "2026-08-25" },
        TODAY
      )
    ).toBeNull();
    // date de fin = aujourd'hui → encore visible
    expect(
      visibleHighlight(
        { highlight_title: "x", highlight_until: TODAY },
        TODAY
      )
    ).not.toBeNull();
    // date de fin = demain → visible
    expect(
      visibleHighlight(
        { highlight_title: "x", highlight_until: "2026-08-27" },
        TODAY
      )
    ).not.toBeNull();
  });

  it("sans date de fin → toujours visible (si contenu)", () => {
    expect(
      visibleHighlight(
        { highlight_title: "x", highlight_until: null },
        TODAY
      )
    ).not.toBeNull();
  });
});
