import { z } from "zod";
import { merchantRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { sendEmail, emailLayout } from "@/lib/email";
import { escapeHtml } from "@/lib/campaigns";
import { pushToSubscriptionDetailed } from "@/lib/push";
import { getStripe } from "@/lib/stripe";
import { reportError } from "@/lib/report";
import { isMissingColumnError } from "@/lib/db-errors";
import { refundEligibility } from "@/lib/orders";
import { performOrderRefund, type RefundOutcome } from "@/lib/order-refund";

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
export const GET = merchantRoute({
  handler: async ({ business }) => {
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
  },
});

const PostBody = z.object({
  id: z.unknown().optional(),
  code: z.unknown().optional(),
  status: z.unknown().optional(),
});

/**
 * Fait avancer (ou annule) une commande du commerçant connecté.
 * Ciblage par id (boutons de la liste) ou par code (scan du QR de retrait).
 */
export const POST = merchantRoute({
  schema: PostBody,
  handler: async ({ body: rawBody, business }) => {
    const body = rawBody as { id?: string; code?: string; status?: string };
    const next = String(body.status ?? "");
    const code = String(body.code ?? "").trim().toUpperCase().slice(0, 12);
    if ((!body.id && !code) || !["ready", "done", "cancelled"].includes(next)) {
      return Response.json({ error: "invalid_action" }, { status: 400 });
    }

    const db = getAdminClient();
    // Lecture tolérante : customer_email / notify_push peuvent ne pas exister
    // encore (migrations 0021 / 0036 non appliquées).
    async function fetchOrder(cols: string) {
      let q = db.from("orders").select(cols).eq("business_id", business.id);
      q = body.id ? q.eq("id", body.id) : q.eq("code", code);
      return q.order("created_at", { ascending: false }).limit(1).maybeSingle();
    }
    // Select tolérant étendu au CHEMIN ARGENT (paid / stripe_session_id /
    // refunded, migrations 0040/0047) pour pouvoir déclencher le remboursement
    // à l'annulation. Si ces colonnes manquent, on retombe sur le socle minimal
    // garanti : `refunded` devient alors ILLISIBLE → aucun refund tenté (on ne
    // rembourse jamais un état qu'on ne saurait pas tracer).
    let { data: order, error: selErr } = (await fetchOrder(
      "id, status, code, customer_name, total_cents, customer_email, notify_push, paid, stripe_session_id, refunded, business_id"
    )) as { data: any; error: any };
    let refundReadable = !selErr;
    if (selErr) {
      ({ data: order } = (await fetchOrder(
        "id, status, code, customer_name, total_cents"
      )) as { data: any; error: any });
      refundReadable = false;
    }
    if (!order) return Response.json({ error: "not_found" }, { status: 404 });

    // Compte de la charge directe (0075), lu À PART : l'ajouter au select
    // ci-dessus ferait basculer sur le repli MINIMAL si la colonne manque, et
    // on perdrait `paid` / `refunded` / `customer_email`. Absent → détection
    // automatique dans `performOrderRefund`.
    try {
      const { data: acc } = await db
        .from("orders")
        .select("stripe_account_id")
        .eq("id", order.id)
        .maybeSingle();
      order.stripe_account_id =
        (acc as { stripe_account_id?: string | null } | null)
          ?.stripe_account_id ?? null;
    } catch {
      /* colonne 0075 absente : détection automatique */
    }
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

    // Annulation d'une commande payée EN LIGNE → on déclenche le remboursement
    // (mécanique 11.1 réutilisée telle quelle), en BEST-EFFORT : l'annulation
    // (transition de statut ci-dessus) est déjà actée et ne doit JAMAIS être
    // remise en cause par un échec Stripe. On ne tente le refund que si l'état
    // `refunded` est lisible ET la commande éligible (payée en ligne, non
    // remboursée) — sinon on saute (pas de refund non traçable). Le bouton
    // « Rembourser » reste le repli manuel en cas d'échec ici.
    let refund: RefundOutcome | null = null;
    if (next === "cancelled" && refundReadable) {
      const elig = refundEligibility(order);
      if (elig.ok) {
        try {
          refund = await performOrderRefund(db, getStripe(), {
            ...order,
            business_id: business.id,
          });
        } catch (e) {
          // performOrderRefund ne jette pas, mais getStripe() (config absente)
          // le peut : on capture pour ne jamais bloquer l'annulation.
          refund = {
            status: "failed",
            detail: e instanceof Error ? e.message : "remboursement indisponible",
          };
        }
      } else {
        refund = { status: "skipped", code: elig.code };
      }
    }

    // Le client est prévenu (e-mail + push) quand sa commande devient « prête »
    // OU est « annulée », en best effort : aucune de ces étapes ne doit faire
    // échouer la mise à jour de statut. On renvoie le résultat au commerçant
    // pour qu'il sache ce qui est parti.
    let pushResult: "sent" | "failed" | "none" = "none";
    let pushReason = "none";
    let emailResult: "sent" | "none" = "none";
    if (next === "ready" || next === "cancelled") {
      const isCancel = next === "cancelled";
      const homeUrl = `/${business.slug}/commander`;
      // Mention de paiement de l'e-mail « prête » : ne JAMAIS réclamer un
      // règlement au comptoir pour une commande déjà payée en ligne (le client
      // croirait devoir payer deux fois). `paid` peut être illisible si le
      // select de repli a servi (colonne 0040 absente) : dans ce cas on
      // n'affirme rien plutôt que d'affirmer faux.
      const readyFootnote =
        order.paid === true
          ? "Cette commande est déjà réglée en ligne : rien à payer au retrait."
          : order.paid === false
          ? "Le paiement se fait sur place, au comptoir, lors du retrait."
          : undefined;
      // Push vers l'appareil du client (s'il l'a demandé à la commande)
      try {
        if (order.notify_push) {
          const res = await pushToSubscriptionDetailed(order.notify_push, {
            title: isCancel
              ? `❌ Commande annulée`
              : `✅ Votre commande est prête !`,
            body: isCancel
              ? `${business.name} — votre commande ${order.code} a été annulée.`
              : `${business.name} — commande ${order.code}. Venez la récupérer 🎉`,
            url: homeUrl,
          });
          pushResult = res.ok ? "sent" : "failed";
          pushReason = res.reason;
        }
      } catch {
        pushResult = "failed"; // push best effort
        pushReason = "error";
      }
      // E-mail au client (s'il a laissé son adresse)
      try {
        if (order.customer_email) {
          await sendEmail(
            isCancel
              ? {
                  to: order.customer_email,
                  subject: `Votre commande ${order.code} chez ${business.name} a été annulée`,
                  fromName: `${business.name} via Kado`,
                  html: emailLayout({
                    preview: `Votre commande a été annulée.`,
                    emoji: "❌",
                    heading: `Commande annulée${
                      order.customer_name
                        ? `, ${escapeHtml(order.customer_name)}`
                        : ""
                    }`,
                    bodyHtml: `
                <p style="margin:0 0 14px;">Votre commande <b>${escapeHtml(
                  order.code
                )}</b> chez <b>${escapeHtml(
                        business.name
                      )}</b> a été <b>annulée</b>.</p>
                <p style="margin:0 0 8px;">Pour toute question, rapprochez-vous directement du commerce.</p>`,
                    footnote:
                      refund?.status === "refunded"
                        ? "Votre paiement en ligne a été remboursé."
                        : "Pour toute question sur un éventuel remboursement, rapprochez-vous du commerce.",
                  }),
                  text: `Votre commande ${order.code} chez ${business.name} a été annulée.`,
                }
              : {
                  to: order.customer_email,
                  subject: `Votre commande ${order.code} est prête chez ${business.name}`,
                  fromName: `${business.name} via Kado`,
                  html: emailLayout({
                    preview: `Votre commande est prête, venez la récupérer !`,
                    emoji: "✅",
                    heading: `C'est prêt${
                      order.customer_name
                        ? `, ${escapeHtml(order.customer_name)}`
                        : ""
                    } !`,
                    bodyHtml: `
                <p style="margin:0 0 14px;">Votre commande chez <b>${escapeHtml(
                  business.name
                )}</b> est <b>prête</b>. Présentez ce code au retrait :</p>
                <p style="margin:0 0 8px;text-align:center;"><span style="display:inline-block;font-family:monospace;font-size:30px;font-weight:800;letter-spacing:0.15em;background:#f7f5fb;border:2px dashed #cfc5e5;border-radius:14px;padding:12px 22px;">${escapeHtml(
                  order.code
                )}</span></p>`,
                    footnote: readyFootnote,
                  }),
                  text: `Votre commande ${order.code} chez ${business.name} est prête. Venez la récupérer !`,
                }
          );
          emailResult = "sent"; // marqué seulement après un envoi réussi
        }
      } catch {
        /* e-mail best effort */
      }
      // Horodatage « prête » (tolérant : la colonne peut ne pas exister). Propre
      // à la transition « ready » — pas pertinent pour une annulation.
      if (!isCancel) {
        try {
          const { error } = await db
            .from("orders")
            .update({ notified_ready_at: new Date().toISOString() })
            .eq("id", order.id)
            .eq("business_id", business.id);
          if (error && !isMissingColumnError(error)) {
            reportError(error, { where: "dashboard/orders.notified_ready" });
          }
        } catch (e) {
          reportError(e, { where: "dashboard/orders.notified_ready" });
        }
      }
    }

    return Response.json({
      ok: true,
      refund,
      notified: { push: pushResult, email: emailResult, reason: pushReason },
      order: {
        code: order.code,
        customer_name: order.customer_name,
        total_cents: order.total_cents,
      },
    });
  },
});
