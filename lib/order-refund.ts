import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { refundEligibility } from "@/lib/orders";

/**
 * Cœur d'effets du remboursement d'une commande click & collect payée EN LIGNE,
 * extrait de `app/api/dashboard/orders/refund/route.ts` (story 11.1) pour être
 * réutilisé tel quel à l'annulation (story 11.2) — zéro duplication du chemin
 * argent.
 *
 * Le paiement C&C est une charge « destination » : le refund est émis sur le
 * compte PLATEFORME (`stripe` sans `{ stripeAccount }`) avec
 * `reverse_transfer: true` (reprend l'argent chez le commerçant) et
 * `refund_application_fee: true` (rend la commission plateforme). Clé
 * d'idempotence dérivée de `order.id` → un rejeu (clic manuel « Rembourser »
 * après l'annulation, retry réseau…) ne double-rembourse jamais.
 *
 * Ordre strict (anti-corruption d'état) :
 *   1. éligibilité (payée en ligne, pas déjà remboursée) ;
 *   2. récupérer le `payment_intent` depuis la Checkout Session ;
 *   3. créer le refund Stripe (idempotent) ;
 *   4. SEULEMENT en cas de succès, marquer la commande remboursée
 *      (filtrée par `business_id` ET `refunded=false`).
 *
 * Cette fonction NE JETTE JAMAIS : elle renvoie un `RefundOutcome` structuré
 * pour que l'appelant (route dédiée ou annulation best-effort) décide du
 * mapping HTTP / du message commerçant.
 */
export type RefundOutcome =
  | { status: "refunded"; stripeRefundId: string }
  | { status: "skipped"; code: "not_online_paid" | "already_refunded" }
  | { status: "no_payment_intent" }
  | { status: "failed"; detail: string }
  | { status: "record_failed"; stripeRefundId: string };

export async function performOrderRefund(
  db: SupabaseClient,
  stripe: Stripe,
  order: {
    id: string;
    business_id: string;
    paid?: boolean | null;
    stripe_session_id?: string | null;
    refunded?: boolean | null;
  }
): Promise<RefundOutcome> {
  // 1. Éligibilité (garde d'idempotence AVANT tout appel Stripe : un rejeu d'une
  // commande remboursée ou payée sur place ne rappelle pas Stripe).
  const elig = refundEligibility(order);
  if (!elig.ok) return { status: "skipped", code: elig.code };

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
    return {
      status: "failed",
      detail: e instanceof Error ? e.message : "session introuvable",
    };
  }
  if (!paymentIntent) return { status: "no_payment_intent" };

  // 3. Créer le refund PLATEFORME avec reverse_transfer (jamais
  // { stripeAccount } : le C&C est une charge destination).
  let refund: Stripe.Refund;
  try {
    refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntent,
        reverse_transfer: true,
        refund_application_fee: true,
        // Lien fiable événement→commande pour la réconciliation par webhook
        // (`reconcileRefundEvent`) : dans le cas record_failed, `stripe_refund_id`
        // n'est jamais écrit côté commande, donc `refund.metadata.order_id` est
        // le seul moyen de retrouver la commande. `order.id` (UUID PK) suffit.
        metadata: { order_id: order.id },
      },
      { idempotencyKey: `order-refund-${order.id}` }
    );
  } catch (e) {
    return {
      status: "failed",
      detail: e instanceof Error ? e.message : "échec du remboursement",
    };
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
    .eq("business_id", order.business_id)
    .eq("refunded", false);
  if (updErr) {
    // Le refund Stripe A RÉUSSI : on renvoie son id (réconciliation). La clé
    // d'idempotence empêche un double refund à la reprise.
    return { status: "record_failed", stripeRefundId: refund.id };
  }

  return { status: "refunded", stripeRefundId: refund.id };
}
