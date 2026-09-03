import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { refundEligibility } from "@/lib/orders";

/**
 * Cœur d'effets du remboursement d'une commande click & collect payée EN LIGNE,
 * extrait de `app/api/dashboard/orders/refund/route.ts` (story 11.1) pour être
 * réutilisé tel quel à l'annulation (story 11.2) — zéro duplication du chemin
 * argent.
 *
 * DEUX SCHÉMAS DE PAIEMENT cohabitent, distingués par `order.stripe_account_id`
 * (migration 0075) :
 *
 *  - **charge DIRECTE** (colonne renseignée — schéma actuel) : le paiement vit
 *    sur le compte DU COMMERÇANT. Session et refund doivent donc repasser
 *    `{ stripeAccount }`. Pas de `reverse_transfer` : aucun transfert n'a eu
 *    lieu, l'argent n'a jamais quitté son compte. `refund_application_fee`
 *    rend la commission encaissée par la plateforme.
 *  - **charge « destination »** (colonne vide — commandes antérieures) : le
 *    refund est émis sur le compte PLATEFORME avec `reverse_transfer: true`
 *    (reprend l'argent chez le commerçant).
 *
 * Clé d'idempotence dérivée de `order.id` → un rejeu (clic manuel
 * « Rembourser » après l'annulation, retry réseau…) ne double-rembourse jamais.
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
    stripe_account_id?: string | null;
    refunded?: boolean | null;
  }
): Promise<RefundOutcome> {
  // 1. Éligibilité (garde d'idempotence AVANT tout appel Stripe : un rejeu d'une
  // commande remboursée ou payée sur place ne rappelle pas Stripe).
  const elig = refundEligibility(order);
  if (!elig.ok) return { status: "skipped", code: elig.code };

  // Compte candidat pour une charge DIRECTE : la colonne 0075 si elle est
  // renseignée, sinon le compte Stripe actuel du commerçant. Ce repli comble la
  // fenêtre où 0075 n'est pas encore appliquée : sans lui, une commande payée
  // pendant cette fenêtre serait DÉFINITIVEMENT non remboursable depuis Kado.
  let candidate = order.stripe_account_id || null;
  if (!candidate) {
    try {
      const { data } = await db
        .from("businesses")
        .select("stripe_account_id")
        .eq("id", order.business_id)
        .maybeSingle();
      candidate =
        (data as { stripe_account_id?: string | null } | null)
          ?.stripe_account_id || null;
    } catch {
      candidate = null;
    }
  }

  // 2. Récupérer le PaymentIntent depuis la Checkout Session (seul le
  // stripe_session_id est stocké côté Kado). La session vit sur le compte du
  // commerçant en charge directe, sur celui de la plateforme en charge
  // « destination » : on tente le compte connecté puis on retombe sur la
  // plateforme. Le compte qui répond IDENTIFIE le schéma de façon certaine —
  // le refund est ensuite émis sur ce même compte.
  const sessionId = String(order.stripe_session_id);
  let paymentIntent: string | null = null;
  let acct: string | null = null;
  let lastErr: unknown = null;
  for (const tryAcct of candidate ? [candidate, null] : [null]) {
    try {
      const session = await stripe.checkout.sessions.retrieve(
        sessionId,
        undefined,
        tryAcct ? { stripeAccount: tryAcct } : undefined
      );
      paymentIntent =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;
      acct = tryAcct;
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr) {
    return {
      status: "failed",
      detail:
        lastErr instanceof Error ? lastErr.message : "session introuvable",
    };
  }
  if (!paymentIntent) return { status: "no_payment_intent" };
  const onAccount = acct ? { stripeAccount: acct } : undefined;

  // 3. Créer le refund sur le bon compte. En charge directe, `reverse_transfer`
  // est OMIS : il n'existe aucun transfert à annuler, et Stripe rejetterait le
  // paramètre. `refund_application_fee` s'applique dans les deux schémas et
  // restitue la commission prélevée par la plateforme.
  let refund: Stripe.Refund;
  try {
    refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntent,
        ...(acct ? {} : { reverse_transfer: true }),
        refund_application_fee: true,
        // Lien fiable événement→commande pour la réconciliation par webhook
        // (`reconcileRefundEvent`) : dans le cas record_failed, `stripe_refund_id`
        // n'est jamais écrit côté commande, donc `refund.metadata.order_id` est
        // le seul moyen de retrouver la commande. `order.id` (UUID PK) suffit.
        metadata: { order_id: order.id },
      },
      { idempotencyKey: `order-refund-${order.id}`, ...(onAccount ?? {}) }
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
