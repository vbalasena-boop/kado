import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { reportError } from "@/lib/report";
import { isMissingColumnError } from "@/lib/db-errors";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { hasAccess, hasClickCollect } from "@/lib/auth";
import { sendEmail, getOwnerContact } from "@/lib/email";
import { isOpenNow, nextOpeningLabel, type OrderHours } from "@/lib/hours";
import { sendPushToBusiness } from "@/lib/push";
import { getStripe } from "@/lib/stripe";
import {
  pickupCode,
  formatEuros,
  loadOrderableBusiness,
  recalcCart,
  insertOrderTolerant,
  createOrderCheckout,
  nextOrderNumber,
  buildCustomerOrderEmail,
  buildMerchantOrderEmail,
} from "@/lib/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Crée une commande Click & collect (publique). Le total est recalculé côté
 * serveur à partir du catalogue. La logique métier est dans `lib/orders.ts` ;
 * cette route valide l'entrée puis orchestre.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!(await rateLimit(`order:${ip}`, 5, 60))) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: {
    slug?: string;
    name?: string;
    phone?: string;
    email?: string;
    pickup?: string;
    note?: string;
    mode?: string;
    table?: string;
    items?: { id?: string; qty?: number }[];
    push?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim().slice(0, 80);
  const phone = String(body.phone ?? "").trim().slice(0, 25);
  const email = String(body.email ?? "").trim().slice(0, 120);
  const pickup = String(body.pickup ?? "").trim().slice(0, 60);
  const note = String(body.note ?? "").trim().slice(0, 300);
  const serviceMode = body.mode === "sur_place" ? "sur_place" : "emporter";
  const tableLabel =
    serviceMode === "sur_place"
      ? String(body.table ?? "").trim().slice(0, 40)
      : "";
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: "bad_email" }, { status: 400 });
  }
  // Abonnement push du client (opt-in) pour l'alerte « commande prête ».
  const pushEndpoint = String(body.push?.endpoint ?? "");
  const notifyPush =
    pushEndpoint.startsWith("https://") &&
    body.push?.keys?.p256dh &&
    body.push?.keys?.auth
      ? {
          endpoint: pushEndpoint.slice(0, 1000),
          p256dh: String(body.push!.keys!.p256dh),
          auth: String(body.push!.keys!.auth),
        }
      : null;
  const items = (body.items ?? []).filter(
    (i) => i?.id && Number.isInteger(i.qty) && (i.qty as number) > 0
  );
  if (!body.slug || !name || !phone || phone.replace(/\D/g, "").length < 9) {
    return Response.json({ error: "missing_fields" }, { status: 400 });
  }
  if (items.length === 0 || items.length > 30) {
    return Response.json({ error: "empty_cart" }, { status: 400 });
  }

  const db = getAdminClient();
  const biz = await loadOrderableBusiness(db, body.slug);
  // Règle UNIQUE (lib/auth) : essai, formules « Comptoir »/« Complet », ou
  // option `click_collect`. Miroir exact du garde de la page /commander.
  const orderOn = !!biz && hasClickCollect(biz);
  if (!biz || !orderOn) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if (!hasAccess(biz)) {
    return Response.json({ error: "unavailable" }, { status: 403 });
  }

  // Horaires de commande (lecture tolérante si la colonne manque)
  try {
    const { data: h } = await db
      .from("businesses")
      .select("order_hours")
      .eq("id", biz.id)
      .maybeSingle();
    const hours = (h as any)?.order_hours as OrderHours | null;
    if (!isOpenNow(hours)) {
      return Response.json(
        { error: "closed", next: nextOpeningLabel(hours) },
        { status: 403 }
      );
    }
  } catch {
    /* colonne absente : pas d'horaires configurés */
  }

  // Recalcule le panier depuis le catalogue (les prix du client sont ignorés).
  const cart = await recalcCart(db, biz.id, items);
  if (!cart.ok) {
    return Response.json({ error: cart.error }, { status: 400 });
  }
  const { lines, total } = cart;

  // Paiement en ligne activé + compte Stripe du commerçant prêt ?
  const wantsOnline =
    total > 0 &&
    biz.online_payment === true &&
    biz.stripe_account_ready === true &&
    !!biz.stripe_account_id;

  const code = pickupCode();
  const baseInsert: Record<string, unknown> = {
    business_id: biz.id,
    code,
    customer_name: name,
    customer_phone: phone,
    pickup_at: pickup || null,
    note: note || null,
    items: lines,
    total_cents: total,
    // Paiement en ligne : la commande attend le règlement avant d'apparaître
    // chez le commerçant. Sinon, directement « à préparer ».
    status: wantsOnline ? "awaiting_payment" : "new",
  };
  // Numéro lisible annoncé au comptoir (0076). Dans `optional` uniquement :
  // si la colonne manque, `insertOrderTolerant` retombe sur le socle et la
  // commande est créée sans numéro plutôt que de rater.
  const orderNo = await nextOrderNumber(db, biz.id);

  const optional: Record<string, unknown> = { ...baseInsert };
  if (orderNo != null) optional.order_no = orderNo;
  if (email) optional.customer_email = email;
  if (notifyPush) optional.notify_push = notifyPush;
  optional.service_mode = serviceMode;
  if (tableLabel) optional.table_label = tableLabel;

  const { error } = await insertOrderTolerant(db, baseInsert, optional);
  if (error) {
    return Response.json(
      { error: "save_failed", detail: error.message },
      { status: 500 }
    );
  }

  // ---- Paiement en ligne (Stripe Connect) : l'argent va au commerçant ----
  if (wantsOnline) {
    try {
      const session = await createOrderCheckout({
        stripe: getStripe(),
        origin: new URL(req.url).origin,
        biz,
        code,
        lines,
        total,
        email: email || null,
      });
      // Mémorise la session pour réconciliation (best effort). Chemin client :
      // on ne bloque JAMAIS le paiement pour ça, mais on ne gobe plus une vraie
      // panne en silence (colonne absente → ignoré ; sinon reportError).
      try {
        const { error } = await db
          .from("orders")
          .update({ stripe_session_id: session.id })
          .eq("business_id", biz.id)
          .eq("code", code);
        if (error && !isMissingColumnError(error)) {
          reportError(error, { where: "order.session", code });
        }
      } catch (e) {
        reportError(e, { where: "order.session", code });
      }
      // Écriture SÉPARÉE et tolérante de `stripe_account_id` (0075) : le compte
      // connecté sur lequel la charge DIRECTE a été créée, indispensable pour
      // rembourser (le refund doit repasser le même `{ stripeAccount }`).
      // Isolée exprès — groupée avec `stripe_session_id`, une colonne 0075
      // absente ferait échouer TOUTE la mise à jour et le refund deviendrait
      // impossible faute de session enregistrée.
      try {
        const { error } = await db
          .from("orders")
          .update({ stripe_account_id: biz.stripe_account_id })
          .eq("business_id", biz.id)
          .eq("code", code);
        if (error && !isMissingColumnError(error)) {
          reportError(error, { where: "order.account", code });
        }
      } catch (e) {
        reportError(e, { where: "order.account", code });
      }
      return Response.json({
        ok: true,
        code,
        order_no: orderNo,
        total_cents: total,
        checkoutUrl: session.url,
      });
    } catch (e: any) {
      // Échec de création du paiement : on annule la commande en attente
      // (best effort — on renvoie 500 payment_failed quoi qu'il arrive, mais on
      // ne gobe plus une vraie panne de l'annulation en silence).
      try {
        const { error } = await db
          .from("orders")
          .update({ status: "cancelled" })
          .eq("business_id", biz.id)
          .eq("code", code);
        if (error && !isMissingColumnError(error)) {
          reportError(error, { where: "order.cancel", code });
        }
      } catch (err) {
        reportError(err, { where: "order.cancel", code });
      }
      return Response.json(
        { error: "payment_failed", detail: e?.message ?? "stripe" },
        { status: 500 }
      );
    }
  }

  // Notification push au commerçant (best effort)
  try {
    await sendPushToBusiness(db, biz.id, {
      title: `🛒 Nouvelle commande ${code}`,
      body: `${name} · ${formatEuros(total)} € · retrait ${
        pickup || "dès que possible"
      }`,
      url: "/dashboard/orders",
    });
  } catch {
    /* le push ne doit pas bloquer la commande */
  }

  // Bon de commande e-mail au client (best effort)
  if (email) {
    try {
      await sendEmail(
        buildCustomerOrderEmail({
          to: email,
          name,
          code,
          bizName: biz.name,
          pickup,
          lines,
          total,
          orderNo,
        })
      );
    } catch {
      /* le bon de commande ne doit pas bloquer la commande */
    }
  }

  // Alerte e-mail au commerçant (best effort)
  try {
    const { email: ownerEmail } = await getOwnerContact(db, biz.id);
    if (ownerEmail) {
      await sendEmail(
        buildMerchantOrderEmail({
          to: ownerEmail,
          name,
          phone,
          code,
          pickup,
          note,
          lines,
          total,
        })
      );
    }
  } catch {
    /* l'e-mail ne doit pas bloquer la commande */
  }

  return Response.json({ ok: true, code, order_no: orderNo, total_cents: total });
}
