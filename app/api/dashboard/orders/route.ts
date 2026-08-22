import { NextRequest } from "next/server";
import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { sendEmail, emailLayout } from "@/lib/email";
import { escapeHtml } from "@/lib/campaigns";
import { sendPushToSubscription } from "@/lib/push";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED: Record<string, string[]> = {
  // transitions autorisées depuis chaque statut (au retrait, une commande
  // encore « nouvelle » peut passer directement à « retirée »)
  new: ["ready", "done", "cancelled"],
  ready: ["done", "cancelled"],
};

/**
 * Sondage léger pour les alertes : nombre de commandes à préparer et
 * identifiant de la plus récente (pour détecter une nouvelle arrivée).
 */
export async function GET() {
  const { business } = await getMyBusiness();
  if (!business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }
  const db = getAdminClient();
  try {
    const { count } = await db
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("status", "new");
    const { data: latest } = await db
      .from("orders")
      .select("id, code, customer_name, total_cents")
      .eq("business_id", business.id)
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return Response.json({
      pending: count ?? 0,
      latestId: latest?.id ?? null,
      latestCode: latest?.code ?? null,
      latestName: latest?.customer_name ?? null,
      latestTotal: latest?.total_cents ?? 0,
    });
  } catch {
    return Response.json({ pending: 0, latestId: null });
  }
}

/**
 * Fait avancer (ou annule) une commande du commerçant connecté.
 * Ciblage par id (boutons de la liste) ou par code (scan du QR de retrait).
 */
export async function POST(req: NextRequest) {
  const { business } = await getMyBusiness();
  if (!business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: { id?: string; code?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const next = String(body.status ?? "");
  const code = String(body.code ?? "").trim().toUpperCase().slice(0, 12);
  if ((!body.id && !code) || !["ready", "done", "cancelled"].includes(next)) {
    return Response.json({ error: "invalid_action" }, { status: 400 });
  }

  const db = getAdminClient();
  // Lecture tolérante : customer_email / notify_push peuvent ne pas exister
  // encore (migrations 0021 / 0036 non appliquées).
  async function fetchOrder(cols: string) {
    let q = db.from("orders").select(cols).eq("business_id", business!.id);
    q = body.id ? q.eq("id", body.id) : q.eq("code", code);
    return q.order("created_at", { ascending: false }).limit(1).maybeSingle();
  }
  let { data: order, error: selErr } = (await fetchOrder(
    "id, status, code, customer_name, total_cents, customer_email, notify_push"
  )) as { data: any; error: any };
  if (selErr) {
    ({ data: order } = (await fetchOrder(
      "id, status, code, customer_name, total_cents"
    )) as { data: any; error: any });
  }
  if (!order) return Response.json({ error: "not_found" }, { status: 404 });
  if (!(ALLOWED[order.status] ?? []).includes(next)) {
    return Response.json(
      {
        error:
          order.status === "done"
            ? "already_done"
            : order.status === "cancelled"
            ? "already_cancelled"
            : "invalid_transition",
        order: {
          code: order.code,
          customer_name: order.customer_name,
          total_cents: order.total_cents,
        },
      },
      { status: 400 }
    );
  }

  const { error } = await db
    .from("orders")
    .update({ status: next })
    .eq("id", order.id)
    .eq("business_id", business.id);
  if (error) return Response.json({ error: "update_failed" }, { status: 500 });

  // Commande prête → on prévient le client (e-mail + push), en best effort :
  // aucune de ces étapes ne doit faire échouer la mise à jour de statut.
  if (next === "ready") {
    const homeUrl = `/${business.slug}/commander`;
    // Push vers l'appareil du client (s'il l'a demandé à la commande)
    try {
      if (order.notify_push) {
        await sendPushToSubscription(order.notify_push, {
          title: `✅ Votre commande est prête !`,
          body: `${business.name} — commande ${order.code}. Venez la récupérer 🎉`,
          url: homeUrl,
        });
      }
    } catch {
      /* push best effort */
    }
    // E-mail au client (s'il a laissé son adresse)
    try {
      if (order.customer_email) {
        await sendEmail({
          to: order.customer_email,
          subject: `Votre commande ${order.code} est prête chez ${business.name}`,
          fromName: `${business.name} via Kado`,
          html: emailLayout({
            preview: `Votre commande est prête, venez la récupérer !`,
            emoji: "✅",
            heading: `C'est prêt${
              order.customer_name ? `, ${escapeHtml(order.customer_name)}` : ""
            } !`,
            bodyHtml: `
              <p style="margin:0 0 14px;">Votre commande chez <b>${escapeHtml(
                business.name
              )}</b> est <b>prête</b>. Présentez ce code au retrait :</p>
              <p style="margin:0 0 8px;text-align:center;"><span style="display:inline-block;font-family:monospace;font-size:30px;font-weight:800;letter-spacing:0.15em;background:#f7f5fb;border:2px dashed #cfc5e5;border-radius:14px;padding:12px 22px;">${escapeHtml(
                order.code
              )}</span></p>`,
            footnote:
              "Le paiement se fait sur place, au comptoir, lors du retrait.",
          }),
          text: `Votre commande ${order.code} chez ${business.name} est prête. Venez la récupérer !`,
        });
      }
    } catch {
      /* e-mail best effort */
    }
    // Horodatage (tolérant : la colonne peut ne pas exister)
    try {
      await db
        .from("orders")
        .update({ notified_ready_at: new Date().toISOString() })
        .eq("id", order.id)
        .eq("business_id", business.id);
    } catch {
      /* colonne absente */
    }
  }

  return Response.json({
    ok: true,
    order: {
      code: order.code,
      customer_name: order.customer_name,
      total_cents: order.total_cents,
    },
  });
}
