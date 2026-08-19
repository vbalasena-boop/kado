import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { hasAccess } from "@/lib/auth";
import { sendEmail, emailLayout, getOwnerContact } from "@/lib/email";
import { escapeHtml } from "@/lib/campaigns";
import { isOpenNow, nextOpeningLabel, type OrderHours } from "@/lib/hours";
import { sendPushToBusiness } from "@/lib/push";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Code de retrait court, sans caractères ambigus. */
function pickupCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function euros(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Crée une commande Click & collect (publique, paiement sur place).
 * Le total est recalculé côté serveur à partir du catalogue.
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
    items?: { id?: string; qty?: number }[];
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
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: "bad_email" }, { status: 400 });
  }
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
  const { data: biz } = await db
    .from("businesses")
    .select("id, name, slug, status, subscription_status, subscription_ends_at, click_collect")
    .eq("slug", body.slug)
    .maybeSingle();
  // Commande ouverte si l'option est activée — ou pendant l'essai gratuit
  // (toutes les options sont ouvertes pour tester).
  const orderOn =
    !!(biz as any)?.click_collect ||
    (biz as any)?.subscription_status === "trial";
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

  // Recalcule le panier depuis le catalogue (les prix du client sont ignorés)
  const ids = items.map((i) => i.id as string);
  const { data: products } = await db
    .from("products")
    .select("id, name, price_cents, active")
    .eq("business_id", biz.id)
    .in("id", ids);
  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  const lines: { name: string; qty: number; price_cents: number }[] = [];
  let total = 0;
  for (const it of items) {
    const p = byId.get(it.id as string);
    if (!p || !p.active) {
      return Response.json({ error: "product_unavailable" }, { status: 400 });
    }
    const qty = Math.min(it.qty as number, 20);
    lines.push({ name: p.name, qty, price_cents: p.price_cents });
    total += p.price_cents * qty;
  }

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
    status: "new",
  };
  // Insertion tolérante : la colonne customer_email peut ne pas encore exister
  let { error } = await db
    .from("orders")
    .insert(email ? { ...baseInsert, customer_email: email } : baseInsert);
  if (error && email) {
    ({ error } = await db.from("orders").insert(baseInsert));
  }
  if (error) {
    return Response.json(
      { error: "save_failed", detail: error.message },
      { status: 500 }
    );
  }

  // Notification push au commerçant, même téléphone verrouillé (best effort)
  try {
    await sendPushToBusiness(db, biz.id, {
      title: `🛒 Nouvelle commande ${code}`,
      body: `${name} · ${euros(total)} € · retrait ${
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
      const rows = lines
        .map(
          (l) =>
            `<tr><td>${l.qty} × ${escapeHtml(l.name)}</td><td align="right">${euros(
              l.price_cents * l.qty
            )}&nbsp;€</td></tr>`
        )
        .join("");
      await sendEmail({
        to: email,
        subject: `Votre commande ${code} chez ${biz.name}`,
        fromName: `${biz.name} via Kado`,
        html: emailLayout({
          preview: `Bon de commande — à régler sur place au retrait.`,
          emoji: "🛒",
          heading: `Merci ${escapeHtml(name)} !`,
          bodyHtml: `
            <p style="margin:0 0 14px;">Votre commande chez <b>${escapeHtml(
              biz.name
            )}</b> est bien enregistrée. Présentez ce code au retrait :</p>
            <p style="margin:0 0 16px;text-align:center;"><span style="display:inline-block;font-family:monospace;font-size:30px;font-weight:800;letter-spacing:0.15em;background:#f7f5fb;border:2px dashed #cfc5e5;border-radius:14px;padding:12px 22px;">${code}</span></p>
            <p style="margin:0 0 12px;">🕒 Retrait : <b>${
              pickup ? escapeHtml(pickup) : "dès que possible"
            }</b></p>
            <table role="presentation" cellpadding="4" cellspacing="0" style="width:100%;font-size:15px;border-collapse:collapse;">${rows}
            <tr><td style="border-top:1px solid #eee;padding-top:8px;"><b>Total à régler sur place</b></td><td align="right" style="border-top:1px solid #eee;padding-top:8px;"><b>${euros(
              total
            )}&nbsp;€</b></td></tr></table>`,
          footnote:
            "Aucun paiement en ligne : vous réglez au comptoir lors du retrait.",
        }),
        text: `Votre commande ${code} chez ${biz.name} est enregistrée. Retrait : ${
          pickup || "dès que possible"
        }. Total à régler sur place : ${euros(total)} €.`,
      });
    } catch {
      /* le bon de commande ne doit pas bloquer la commande */
    }
  }

  // Alerte e-mail au commerçant (best effort)
  try {
    const { email } = await getOwnerContact(db, biz.id);
    if (email) {
      const rows = lines
        .map(
          (l) =>
            `<tr><td>${l.qty} × ${escapeHtml(l.name)}</td><td align="right">${euros(
              l.price_cents * l.qty
            )}&nbsp;€</td></tr>`
        )
        .join("");
      await sendEmail({
        to: email,
        subject: `🛒 Nouvelle commande ${code} — ${name}`,
        html: emailLayout({
          preview: `${lines.length} article(s), à encaisser sur place.`,
          emoji: "🛒",
          heading: `Nouvelle commande — code ${code}`,
          bodyHtml: `
            <p style="margin:0 0 12px;"><b>${escapeHtml(name)}</b> · <a href="tel:${phone.replace(
              /\s/g,
              ""
            )}" style="color:#f0a52e;">${escapeHtml(phone)}</a></p>
            <p style="margin:0 0 12px;">Retrait souhaité : <b>${
              pickup ? escapeHtml(pickup) : "dès que possible"
            }</b></p>
            ${note ? `<p style="margin:0 0 12px;">📝 ${escapeHtml(note)}</p>` : ""}
            <table role="presentation" cellpadding="4" cellspacing="0" style="width:100%;font-size:15px;border-collapse:collapse;">${rows}
            <tr><td style="border-top:1px solid #eee;padding-top:8px;"><b>Total (à encaisser sur place)</b></td><td align="right" style="border-top:1px solid #eee;padding-top:8px;"><b>${euros(
              total
            )}&nbsp;€</b></td></tr></table>
            <p style="margin:16px 0 0;"><a href="https://kado-app.fr/dashboard/orders" style="display:inline-block;background:linear-gradient(135deg,#ff6b4a,#ff4e87);color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:12px;">Gérer mes commandes</a></p>`,
        }),
        text: `Nouvelle commande ${code} de ${name} (${phone}) — total ${euros(
          total
        )} € à encaisser sur place. Gérez vos commandes sur kado-app.fr/dashboard/orders`,
      });
    }
  } catch {
    /* l'e-mail ne doit pas bloquer la commande */
  }

  return Response.json({ ok: true, code, total_cents: total });
}
