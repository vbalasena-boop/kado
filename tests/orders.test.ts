import { describe, it, expect } from "vitest";
import {
  pickupCode,
  formatEuros,
  recalcCart,
  type OrderItemInput,
} from "@/lib/orders";

/** Mock minimal du client Supabase pour `recalcCart` : from().select().eq().in(). */
function mockDb(products: any[]) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          in: async () => ({ data: products }),
        }),
      }),
    }),
  } as any;
}

describe("recalcCart — anti-fraude prix", () => {
  it("recalcule le total depuis le catalogue (prix client ignoré) et plafonne qty à 20", async () => {
    const db = mockDb([
      { id: "a", name: "Café", price_cents: 250, active: true },
      { id: "b", name: "Thé", price_cents: 300, active: true },
    ]);
    const items: OrderItemInput[] = [
      { id: "a", qty: 2 },
      { id: "b", qty: 100 }, // sera plafonné à 20
    ];
    const r = await recalcCart(db, "biz", items);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.total).toBe(250 * 2 + 300 * 20);
      expect(r.lines).toHaveLength(2);
      expect(r.lines[1].qty).toBe(20);
    }
  });

  it("refuse un produit inconnu ou inactif", async () => {
    const db = mockDb([{ id: "a", name: "Café", price_cents: 250, active: false }]);
    const r = await recalcCart(db, "biz", [{ id: "a", qty: 1 }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("product_unavailable");
  });
});

describe("pickupCode", () => {
  it("génère 5 caractères sans lettres/chiffres ambigus", () => {
    for (let i = 0; i < 50; i++) {
      const c = pickupCode();
      expect(c).toHaveLength(5);
      expect(c).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/); // ni O/0/I/1
    }
  });
});

describe("formatEuros", () => {
  it("formate les centimes en euros (fr-FR)", () => {
    expect(formatEuros(1234)).toBe("12,34");
    expect(formatEuros(500)).toBe("5,00");
    expect(formatEuros(0)).toBe("0,00");
  });
});
