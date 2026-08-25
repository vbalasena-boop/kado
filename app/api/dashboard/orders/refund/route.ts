import { z } from "zod";
import { merchantRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { refundEligibility } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({ id: z.string().min(1) });

/**
 * Rembourse une commande click & collect payée EN LIGNE.
 *
 * Le paiement C&C est une charge « destination » (l'argent est transféré au
 * compte connecté du commerçant via `payment_intent_data.transfer_data`). Le
 * refund est donc émis sur le compte PLATEFORME (`getStripe()`, sans
 * `{ stripeAccount }`) avec `reverse_transfer: true` (reprend l'argent chez le
 * commerçant) et `refund_application_fee: true` (rend la commission plateforme).
 *
 * Ordre strict (anti-corruption d'état) :
 *   1. contrôler l'éligibilité (payée en ligne, pas déjà remboursée) ;
 *   2. récupérer le `payment_intent` depuis la Checkout Session ;
 *   3. créer le refund Stripe (clé d'idempotence dérivée de `order.id`) ;
 *   4. SEULEMENT en cas de succès, marquer la commande remboursée
 *      (filtrée par `business_id` ET `refunded=false`).
 * Un échec Stripe → erreur claire (FR) et AUCUNE écriture de la commande.
 */
export const POST = merchantRoute({
  schema: Body,
  rateLimit: {
    key: ({ ip }) => `order-refund:${ip}`,
    limit: 20,
    windowSeconds: 60,
  },
  handler: async ({ body, business }) => {
    const id = String((body as { id: string }).id);
    const db = getAdminClient();

    // Lecture scoping business_id (isolation multi-tenant). On lit `refunded` :
    // c'est un CHEMIN ARGENT, on refuse de rembourser tant qu'on ne peut pas
    // lire ni enregistrer l'état de remboursement.
    const { data: order, error: selErr } = (await db
      .from("orders")
      .select("id, status, paid, stripe_session_id, refunded, code, total_cents")
      .eq("id", id)
      .eq("business_id", business.id)
      .maybeSingle()) as { data: any; error: any };
    if (selErr) {
      // Colonne `refunded` absente (migration 0047 non appliquée) ou erreur de
      // lecture : on échoue PROPREMENT — jamais émettre un refund Stripe qu'on
      // ne saurait pas tracer (il deviendrait re-déclenchable). Fail-closed.
      return Response.json(
        {
          error: "refund_unavailable",
          detail:
            "Remboursement momentanément indisponible (migration 0047 requise). Réessayez une fois la base à jour.",
        },
        { status: 503 }
      );
    }
    if (!order) return Response.json({ error: "not_found" }, { status: 404 });

    // 1. Éligibilité (payée en ligne + pas déjà remboursée). Garde d'idempotence
    // AVANT tout appel Stripe : un rejeu d'une commande remboursée ne rappelle
    // pas Stripe.
    const elig = refundEligibility(order);
    if (!elig.ok) {
      const detail =
        elig.code === "already_refunded"
          ? "Cette commande a déjà été remboursée."
          : "Cette commande n'a pas été payée en ligne — rien à rembourser.";
      return Response.json({ error: elig.code, detail }, { status: 400 });
    }

    const stripe = getStripe();

    // 2. Récupérer le PaymentIntent depuis la Checkout Session (seul le
    // stripe_session_id est stocké côté Kado).
    let paymentIntent: string | null = null;
    try {
      const session = await stripe.checkout.sessions.retrieve(
        String(order.stripe_session_id)
      );
      paymentIntent =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;
    } catch (e) {
      const detail = e instanceof Error ? e.message : "session introuvable";
      return Response.json(
        { error: "refund_failed", detail: `Stripe : ${detail}` },
        { status: 502 }
      );
    }
    if (!paymentIntent) {
      return Response.json(
        {
          error: "no_payment_intent",
          detail: "Paiement Stripe introuvable pour cette commande.",
        },
        { status: 400 }
      );
    }

    // 3. Créer le refund PLATEFORME avec reverse_transfer (jamais
    // { stripeAccount } : le C&C est une charge destination). Clé
    // d'idempotence dérivée de order.id → un rejeu réseau ne double-rembourse
    // pas.
    let refund;
    try {
      refund = await stripe.refunds.create(
        {
          payment_intent: paymentIntent,
          reverse_transfer: true,
          refund_application_fee: true,
        },
        { idempotencyKey: `order-refund-${order.id}` }
      );
    } catch (e) {
      const detail = e instanceof Error ? e.message : "échec du remboursement";
      return Response.json(
        { error: "refund_failed", detail: `Stripe : ${detail}` },
        { status: 502 }
      );
    }

    // 4. Succès Stripe → marquer la commande remboursée. Filtre `refunded=false`
    // (garde d'idempotence à l'écriture) + `business_id` (isolation). Le `status`
    // de fulfilment n'est PAS touché : le remboursement est un drapeau distinct.
    const { error: updErr } = await db
      .from("orders")
      .update({
        refunded: true,
        refunded_at: new Date().toISOString(),
        stripe_refund_id: refund.id,
      })
      .eq("id", order.id)
      .eq("business_id", business.id)
      .eq("refunded", false);
    if (updErr) {
      // Le refund Stripe A RÉUSSI : on ne renvoie pas d'échec silencieux. La
      // clé d'idempotence empêche un double refund à la reprise.
      return Response.json(
        {
          error: "refund_recorded_partially",
          detail:
            "Remboursement Stripe effectué mais l'état n'a pu être enregistré (migration 0047 ?).",
          stripe_refund_id: refund.id,
        },
        { status: 502 }
      );
    }

    return Response.json({
      ok: true,
      refunded: true,
      stripe_refund_id: refund.id,
      order: { code: order.code, total_cents: order.total_cents },
    });
  },
});
