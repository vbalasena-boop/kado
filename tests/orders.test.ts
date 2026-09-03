import { describe, it, expect } from "vitest";
import {
  pickupCode,
  formatEuros,
  recalcCart,
  buildCustomerOrderEmail,
  orderApplicationFee,
  orderMatchesQuery,
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

describe("orderApplicationFee", () => {
  it("sans configuration : aucune commission", () => {
    expect(orderApplicationFee(1800, {})).toBe(0);
  });

  it("pourcentage seul : 2,5 % de 18 € = 0,45 €", () => {
    expect(orderApplicationFee(1800, { bps: 250 })).toBe(45);
  });

  it("part fixe cumulée au pourcentage", () => {
    // 2,5 % de 18 € (45 c) + 25 c = 70 c — couvre les frais Stripe (~52 c).
    expect(orderApplicationFee(1800, { bps: 250, fixedCents: 25 })).toBe(70);
  });

  it("part fixe seule", () => {
    expect(orderApplicationFee(1800, { fixedCents: 25 })).toBe(25);
  });

  it("ne dépasse JAMAIS le total (Stripe refuserait la session)", () => {
    // Panier de 0,10 € avec un fixe de 0,25 € : borné à 0,10 €.
    expect(orderApplicationFee(10, { fixedCents: 25 })).toBe(10);
    expect(orderApplicationFee(0, { bps: 250, fixedCents: 25 })).toBe(0);
  });

  it("valeurs négatives ou invalides neutralisées", () => {
    expect(orderApplicationFee(-100, { bps: 250 })).toBe(0);
    expect(orderApplicationFee(1800, { bps: -250, fixedCents: -25 })).toBe(0);
    expect(orderApplicationFee(NaN, { bps: 250 })).toBe(0);
  });

  it("arrondit au centime", () => {
    // 2,5 % de 17,50 € = 43,75 c → 44 c
    expect(orderApplicationFee(1750, { bps: 250 })).toBe(44);
  });
});

describe("orderMatchesQuery", () => {
  const o = {
    customer_name: "Rozenn Aubin",
    customer_phone: "06 12 34 56 78",
    code: "K7XM3",
    order_no: 12,
  };

  it("requête vide → tout passe", () => {
    expect(orderMatchesQuery(o, "")).toBe(true);
    expect(orderMatchesQuery(o, "   ")).toBe(true);
  });

  it("par nom, insensible à la casse et aux accents", () => {
    expect(orderMatchesQuery(o, "rozenn")).toBe(true);
    expect(orderMatchesQuery(o, "AUBIN")).toBe(true);
    expect(
      orderMatchesQuery({ ...o, customer_name: "Éloïse" }, "eloise")
    ).toBe(true);
  });

  it("par numéro, avec ou sans « n° »", () => {
    expect(orderMatchesQuery(o, "12")).toBe(true);
    expect(orderMatchesQuery(o, "n°12")).toBe(true);
    expect(orderMatchesQuery(o, "n12")).toBe(true);
  });

  it("le numéro est comparé à l'identique, jamais en « contient »", () => {
    // Taper « 1 » ne doit PAS remonter la commande 12.
    expect(orderMatchesQuery(o, "1")).toBe(false);
    expect(orderMatchesQuery(o, "2")).toBe(false);
    expect(orderMatchesQuery({ ...o, order_no: 1 }, "1")).toBe(true);
  });

  it("par code de retrait", () => {
    expect(orderMatchesQuery(o, "k7xm3")).toBe(true);
    expect(orderMatchesQuery(o, "K7X")).toBe(true);
  });

  it("retombe sur buzzer_no si order_no est absent", () => {
    expect(
      orderMatchesQuery({ code: "AB1", buzzer_no: 7, order_no: null }, "7")
    ).toBe(true);
  });

  it("aucune correspondance → false", () => {
    expect(orderMatchesQuery(o, "dupont")).toBe(false);
  });

  it("champs absents : ne jette pas", () => {
    expect(orderMatchesQuery({}, "x")).toBe(false);
    expect(orderMatchesQuery({}, "")).toBe(true);
  });
});

describe("buildCustomerOrderEmail — numéro de commande", () => {
  const base = {
    to: "c@example.com",
    name: "Rozenn",
    code: "K7XM3",
    bizName: "QUSTOS",
    pickup: "12h30",
    lines: [{ name: "Menu mini", qty: 1, price_cents: 1800 }],
    total: 1800,
  };

  it("affiche « Commande n°12 » quand le numéro existe", () => {
    expect(buildCustomerOrderEmail({ ...base, orderNo: 12 }).html).toContain(
      "n°12"
    );
  });

  it("sans numéro : aucune mention vide", () => {
    const html = buildCustomerOrderEmail(base).html;
    expect(html).not.toContain("Commande <b");
    expect(html).toContain("K7XM3");
  });
});
