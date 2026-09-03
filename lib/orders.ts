import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { emailLayout } from "@/lib/email";
import { escapeHtml } from "@/lib/campaigns";

/**
 * Logique métier des commandes (click & collect), extraite de la route
 * `app/api/order/route.ts` qui mélangeait validation, recalcul du panier,
 * création Stripe Connect, gabarits d'e-mail et push. La route se contente
 * désormais d'orchestrer ces fonctions.
 */

export type OrderItemInput = { id?: string; qty?: number };
export type OrderLine = { name: string; qty: number; price_cents: number };

type Db = SupabaseClient;

/** Code de retrait court, sans caractères ambigus. */
export function pickupCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/** Montant en euros formaté (fr-FR, 2 décimales). */
export function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Éligibilité d'une commande au remboursement en ligne (logique pure).
 * Une commande est remboursable si elle a été payée en ligne
 * (`paid=true` + `stripe_session_id` présent) et n'est pas déjà remboursée.
 * Le `status` de fulfilment (new/ready/done/cancelled) n'entre PAS en compte :
 * une commande « retirée » ou « annulée » reste remboursable.
 */
export function refundEligibility(order: {
  paid?: boolean | null;
  stripe_session_id?: string | null;
  refunded?: boolean | null;
}):
  | { ok: true }
  | { ok: false; code: "not_online_paid" | "already_refunded" } {
  if (order.refunded) return { ok: false, code: "already_refunded" };
  if (!order.paid || !String(order.stripe_session_id ?? "").trim()) {
    return { ok: false, code: "not_online_paid" };
  }
  return { ok: true };
}

const BIZ_BASE =
  "id, name, slug, status, subscription_status, subscription_ends_at, click_collect, plan";

/**
 * Charge l'établissement pour une commande (lecture tolérante : les colonnes
 * de paiement en ligne — migration 0040 — peuvent manquer).
 */
export async function loadOrderableBusiness(
  db: Db,
  slug: string
): Promise<any | null> {
  let { data: biz, error } = (await db
    .from("businesses")
    .select(`${BIZ_BASE}, online_payment, stripe_account_id, stripe_account_ready`)
    .eq("slug", slug)
    .maybeSingle()) as { data: any; error: any };
  if (error) {
    ({ data: biz } = (await db
      .from("businesses")
      .select(BIZ_BASE)
      .eq("slug", slug)
      .maybeSingle()) as { data: any; error: any });
  }
  return biz ?? null;
}

/**
 * Recalcule le panier depuis le catalogue (les prix envoyés par le client sont
 * ignorés — anti-fraude). Renvoie les lignes + total, ou une erreur métier.
 */
export async function recalcCart(
  db: Db,
  businessId: string,
  items: OrderItemInput[]
): Promise<
  | { ok: true; lines: OrderLine[]; total: number }
  | { ok: false; error: string }
> {
  const ids = items.map((i) => i.id as string);
  const { data: products } = await db
    .from("products")
    .select("id, name, price_cents, active")
    .eq("business_id", businessId)
    .in("id", ids);
  const byId = new Map((products ?? []).map((p: any) => [p.id, p]));

  const lines: OrderLine[] = [];
  let total = 0;
  for (const it of items) {
    const p: any = byId.get(it.id as string);
    if (!p || !p.active) {
      return { ok: false, error: "product_unavailable" };
    }
    const qty = Math.min(it.qty as number, 20);
    lines.push({ name: p.name, qty, price_cents: p.price_cents });
    total += p.price_cents * qty;
  }
  return { ok: true, lines, total };
}

/**
 * Insère la commande avec repli tolérant : les colonnes récentes
 * (customer_email 0021, notify_push 0036, service_mode 0037) peuvent manquer —
 * on retente alors avec le socle minimal garanti.
 */
export async function insertOrderTolerant(
  db: Db,
  base: Record<string, unknown>,
  optional: Record<string, unknown>
): Promise<{ error: any }> {
  let { error } = await db.from("orders").insert(optional);
  if (error) {
    ({ error } = await db.from("orders").insert(base));
  }
  return { error };
}

/**
 * Crée la session Stripe Checkout (Connect) : l'argent est transféré au compte
 * du commerçant, commission plateforme optionnelle
 * (KADO_ORDER_FEE_BPS + KADO_ORDER_FEE_FIXED_CENTS, cf. orderApplicationFee).
 *
 * CHARGE DIRECTE (`{ stripeAccount }`) : le paiement est créé SUR le compte
 * Stripe du commerçant. L'argent ne transite JAMAIS par la plateforme — seule
 * la commission lui est versée. Conséquences voulues : les frais Stripe et le
 * risque d'impayé sont portés par le commerçant, et la plateforme n'encaisse
 * pas pour le compte d'un tiers (elle ne déclare que sa commission).
 *
 * Contreparties à ne pas oublier :
 *  - les événements Stripe arrivent du COMPTE CONNECTÉ : le webhook doit
 *    accepter la signature d'un endpoint Connect (STRIPE_CONNECT_WEBHOOK_SECRET) ;
 *  - tout appel Stripe ultérieur sur ce paiement (lecture de session, refund)
 *    doit repasser `{ stripeAccount }` — d'où `orders.stripe_account_id` (0075).
 */
/**
 * Commission plateforme prélevée sur une commande payée en ligne, en centimes.
 *
 * Deux parts, cumulables :
 *  - `bps` : pourcentage en points de base (250 = 2,5 %) ;
 *  - `fixedCents` : part fixe par commande (25 = 0,25 €).
 *
 * La part fixe n'est pas un détail : en charge « destination », les frais
 * Stripe sont prélevés sur la PLATEFORME et comportent eux-mêmes un fixe
 * (~0,25 € + ~1,5 %). Une commission purement proportionnelle est donc
 * DÉFICITAIRE sous un certain panier (≈ 25 € à 2,5 %) — d'où ce fixe.
 *
 * La commission est bornée au total : Stripe refuse une session dont la
 * commission dépasse le montant encaissé (petit panier + gros fixe).
 */
export function orderApplicationFee(
  totalCents: number,
  opts: { bps?: number; fixedCents?: number }
): number {
  const total = Number.isFinite(totalCents) ? Math.max(0, totalCents) : 0;
  const bps = Math.max(0, opts.bps ?? 0);
  const fixed = Math.max(0, opts.fixedCents ?? 0);
  const fee = Math.round((total * bps) / 10000) + fixed;
  return Math.max(0, Math.min(fee, total));
}

export function createOrderCheckout(opts: {
  stripe: Stripe;
  origin: string;
  biz: any;
  code: string;
  lines: OrderLine[];
  total: number;
  email: string | null;
}): Promise<Stripe.Checkout.Session> {
  const { stripe, origin, biz, code, lines, total, email } = opts;
  const appFee = orderApplicationFee(total, {
    bps: parseInt(process.env.KADO_ORDER_FEE_BPS || "0", 10) || 0,
    fixedCents:
      parseInt(process.env.KADO_ORDER_FEE_FIXED_CENTS || "0", 10) || 0,
  });
  return stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lines.map((l) => ({
      quantity: l.qty,
      price_data: {
        currency: "eur",
        unit_amount: l.price_cents,
        product_data: { name: l.name },
      },
    })),
    payment_intent_data: {
      // Charge DIRECTE : aucun `transfer_data`. La commission plateforme reste
      // prélevée par Stripe et versée au compte plateforme.
      ...(appFee > 0 ? { application_fee_amount: appFee } : {}),
      description: `Commande ${code} · ${biz.name}`,
    },
    ...(email ? { customer_email: email } : {}),
    success_url: `${origin}/${biz.slug}/suivi/${code}`,
    cancel_url: `${origin}/${biz.slug}/commander?canceled=1`,
    metadata: { kind: "order", order_code: code, business_id: biz.id },
  },
  // ↓ LA bascule : la session est créée SUR le compte du commerçant.
  { stripeAccount: biz.stripe_account_id });
}

function lineRows(lines: OrderLine[]): string {
  return lines
    .map(
      (l) =>
        `<tr><td>${l.qty} × ${escapeHtml(l.name)}</td><td align="right">${formatEuros(
          l.price_cents * l.qty
        )}&nbsp;€</td></tr>`
    )
    .join("");
}

/**
 * Bon de commande e-mail pour le client.
 *
 * `paid` distingue les deux tunnels : règlement au comptoir (défaut) ou
 * commande DÉJÀ payée en ligne (Stripe). Sans cette variante, un client ayant
 * payé recevait « à régler sur place » et pouvait croire devoir payer deux fois.
 */
export function buildCustomerOrderEmail(o: {
  to: string;
  name: string;
  code: string;
  bizName: string;
  pickup: string;
  lines: OrderLine[];
  total: number;
  paid?: boolean;
}) {
  const paid = o.paid === true;
  return {
    to: o.to,
    subject: `Votre commande ${o.code} chez ${o.bizName}`,
    fromName: `${o.bizName} via Kado`,
    html: emailLayout({
      preview: paid
        ? `Commande payée — présentez votre code au retrait.`
        : `Bon de commande — à régler sur place au retrait.`,
      emoji: "🛒",
      heading: `Merci ${escapeHtml(o.name)} !`,
      bodyHtml: `
        <p style="margin:0 0 14px;">Votre commande chez <b>${escapeHtml(
          o.bizName
        )}</b> est bien enregistrée. Présentez ce code au retrait :</p>
        <p style="margin:0 0 16px;text-align:center;"><span style="display:inline-block;font-family:monospace;font-size:30px;font-weight:800;letter-spacing:0.15em;background:#f7f5fb;border:2px dashed #cfc5e5;border-radius:14px;padding:12px 22px;">${o.code}</span></p>
        <p style="margin:0 0 12px;">🕒 Retrait : <b>${
          o.pickup ? escapeHtml(o.pickup) : "dès que possible"
        }</b></p>
        <table role="presentation" cellpadding="4" cellspacing="0" style="width:100%;font-size:15px;border-collapse:collapse;">${lineRows(
          o.lines
        )}
        <tr><td style="border-top:1px solid #eee;padding-top:8px;"><b>${
          paid ? "Total payé en ligne" : "Total à régler sur place"
        }</b></td><td align="right" style="border-top:1px solid #eee;padding-top:8px;"><b>${formatEuros(
          o.total
        )}&nbsp;€</b></td></tr></table>`,
      footnote: paid
        ? "Commande déjà réglée en ligne : rien à payer au retrait."
        : "Aucun paiement en ligne : vous réglez au comptoir lors du retrait.",
    }),
    text: `Votre commande ${o.code} chez ${o.bizName} est enregistrée. Retrait : ${
      o.pickup || "dès que possible"
    }. ${
      paid ? "Total payé en ligne" : "Total à régler sur place"
    } : ${formatEuros(o.total)} €.`,
  };
}

/** Alerte e-mail au commerçant pour une nouvelle commande. */
export function buildMerchantOrderEmail(o: {
  to: string;
  name: string;
  phone: string;
  code: string;
  pickup: string;
  note: string;
  lines: OrderLine[];
  total: number;
}) {
  return {
    to: o.to,
    subject: `🛒 Nouvelle commande ${o.code} — ${o.name}`,
    html: emailLayout({
      preview: `${o.lines.length} article(s), à encaisser sur place.`,
      emoji: "🛒",
      heading: `Nouvelle commande — code ${o.code}`,
      bodyHtml: `
        <p style="margin:0 0 12px;"><b>${escapeHtml(o.name)}</b> · <a href="tel:${o.phone.replace(
          /[^\d+]/g,
          ""
        )}" style="color:#f0a52e;">${escapeHtml(o.phone)}</a></p>
        <p style="margin:0 0 12px;">Retrait souhaité : <b>${
          o.pickup ? escapeHtml(o.pickup) : "dès que possible"
        }</b></p>
        ${o.note ? `<p style="margin:0 0 12px;">📝 ${escapeHtml(o.note)}</p>` : ""}
        <table role="presentation" cellpadding="4" cellspacing="0" style="width:100%;font-size:15px;border-collapse:collapse;">${lineRows(
          o.lines
        )}
        <tr><td style="border-top:1px solid #eee;padding-top:8px;"><b>Total (à encaisser sur place)</b></td><td align="right" style="border-top:1px solid #eee;padding-top:8px;"><b>${formatEuros(
          o.total
        )}&nbsp;€</b></td></tr></table>
        <p style="margin:16px 0 0;"><a href="https://kado-app.fr/dashboard/orders" style="display:inline-block;background:linear-gradient(135deg,#ff6b4a,#ff4e87);color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:12px;">Gérer mes commandes</a></p>`,
    }),
    text: `Nouvelle commande ${o.code} de ${o.name} (${o.phone}) — total ${formatEuros(
      o.total
    )} € à encaisser sur place. Gérez vos commandes sur kado-app.fr/dashboard/orders`,
  };
}
