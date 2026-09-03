import { describe, it, expect } from "vitest";
import {
  pickupCode,
  formatEuros,
  recalcCart,
  buildCustomerOrderEmail,
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

describe("buildCustomerOrderEmail — mention de paiement", () => {
  const base = {
    to: "client@example.com",
    name: "Rozenn",
    code: "AB12C",
    bizName: "QUSTOS",
    pickup: "12h30",
    lines: [{ name: "Menu mini", qty: 1, price_cents: 1800 }],
    total: 1800,
  };

  it("paiement sur place (défaut) : réclame le règlement au comptoir", () => {
    const mail = buildCustomerOrderEmail(base);
    expect(mail.html).toContain("Total à régler sur place");
    expect(mail.html).toContain(
      "Aucun paiement en ligne : vous réglez au comptoir lors du retrait."
    );
    expect(mail.text).toContain("Total à régler sur place");
  });

  it("payée en ligne : ne réclame JAMAIS de règlement au retrait", () => {
    const mail = buildCustomerOrderEmail({ ...base, paid: true });
    expect(mail.html).toContain("Total payé en ligne");
    expect(mail.html).toContain(
      "Commande déjà réglée en ligne : rien à payer au retrait."
    );
    expect(mail.html).not.toContain("à régler sur place");
    expect(mail.html).not.toContain("Aucun paiement en ligne");
    expect(mail.text).toContain("Total payé en ligne");
    expect(mail.text).not.toContain("à régler sur place");
  });

  it("le code de retrait est présent dans les deux cas", () => {
    expect(buildCustomerOrderEmail(base).html).toContain("AB12C");
    expect(buildCustomerOrderEmail({ ...base, paid: true }).html).toContain(
      "AB12C"
    );
  });
});
