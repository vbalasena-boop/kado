import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { reportError } from "@/lib/report";

/**
 * Réconciliation « chemin argent » du statut RÉEL d'un remboursement Stripe
 * (action item F2 de la rétro Epic 11), déclenchée par le webhook plateforme
 * existant (`refund.updated` + `charge.refund.updated` + `refund.failed`).
 *
 * Deux angles morts fermés :
 *   1. `record_failed` — le refund Stripe a réussi mais l'écriture DB initiale
 *      a échoué : `refunded` est resté `false` ET `stripe_refund_id` n'a jamais
 *      été écrit → le bouton « Rembourser » reste cliquable et, passé la fenêtre
 *      d'idempotence Stripe (24 h), un SECOND refund réel peut partir. Le
 *      webhook `succeeded` écrit `refunded=true` + `stripe_refund_id` → ferme la
 *      porte.
 *   2. Refund `pending` qui bascule `failed`/`canceled` (ex. solde négatif
 *      empêchant le `reverse_transfer`) : on annule le drapeau optimiste
 *      (`refunded=false`) pour que le commerçant sache que ça n'a pas abouti.
 *
 * Mapping événement→commande : `refund.metadata.order_id` EN PRIORITÉ (posé à la
 * création par `performOrderRefund` — seul lien fiable dans le cas record_failed
 * où `stripe_refund_id` manque), repli sur `stripe_refund_id = refund.id` pour
 * les refunds créés avant cette story.
 *
 * ANTI-CLOBBER (chemin failed/canceled) : la révocation ne cible QUE la ligne
 * qui référence réellement CE refund (`stripe_refund_id = refund.id`) et
 * seulement si elle est encore `refunded=true`. Une commande peut porter deux
 * refunds successifs (nouvelle clé d'idempotence passé 24 h) ; sans ce garde, un
 * événement `failed` tardif du 1er refund, arrivant APRÈS le `succeeded` du 2ᵉ
 * (Stripe ne garantit pas l'ordre de livraison), effacerait un bon
 * remboursement. Le garde rend aussi la révocation idempotente (rejeu = 0 ligne).
 *
 * Cette fonction NE JETTE JAMAIS et est IDEMPOTENTE (filtres `.eq`) : les
 * colonnes 0047 peuvent manquer (l'update lève ou renvoie `{error}`) → avalé +
 * `reportError` (observabilité), le webhook renvoie toujours 200.
 */
export type ReconcileResult = {
  action: "confirmed" | "reverted" | "noop";
  orderId?: string;
};

/** Horodatage réel du refund (Stripe, unix s) plutôt que l'heure de traitement. */
function refundCreatedIso(refund: Stripe.Refund): string {
  const created = (refund as { created?: number }).created;
  return typeof created === "number" && created > 0
    ? new Date(created * 1000).toISOString()
    : new Date().toISOString();
}

export async function reconcileRefundEvent(
  db: SupabaseClient,
  refund: Stripe.Refund
): Promise<ReconcileResult> {
  try {
    const status = refund.status;
    // Seuls les états terminaux nous intéressent : `pending` (et tout autre
    // état intermédiaire / inconnu) est un no-op.
    if (status !== "succeeded" && status !== "failed" && status !== "canceled") {
      return { action: "noop" };
    }

    const refundId = refund.id;
    // Identité de la commande : metadata.order_id (fiable, posé à la création)
    // en priorité, sinon repli sur l'id du refund déjà stocké côté commande.
    const orderId =
      typeof refund.metadata?.order_id === "string" && refund.metadata.order_id
        ? refund.metadata.order_id
        : null;

    if (status === "succeeded") {
      // Colonne + valeur de filtrage : `order.id` (UUID PK globalement unique →
      // sûr sans filtre business_id) sinon `stripe_refund_id`.
      const filterCol = orderId ? "id" : refundId ? "stripe_refund_id" : null;
      const filterVal = orderId ?? refundId;
      if (!filterCol || !filterVal) return { action: "noop" };

      // Confirme le remboursement : écrit aussi `stripe_refund_id` → ferme
      // l'angle mort record_failed. Filtre `refunded=false` = garde
      // d'idempotence (un rejeu ne modifie 0 ligne, aucun effet).
      const { data, error } = await db
        .from("orders")
        .update({
          refunded: true,
          refunded_at: refundCreatedIso(refund),
          stripe_refund_id: refundId,
        })
        .eq(filterCol, filterVal)
        .eq("refunded", false)
        .select("id");
      if (error) {
        reportError(error, { where: "reconcileRefundEvent", status, refundId });
        return { action: "noop" };
      }
      const rows = Array.isArray(data) ? data.length : 0;
      // 0 ligne = déjà réconcilié (idempotent) OU commande introuvable : dans
      // les deux cas rien à faire, on ne ré-affirme pas « confirmed » à tort.
      if (rows === 0) return { action: "noop" };
      return { action: "confirmed", ...(orderId ? { orderId } : {}) };
    }

    // failed / canceled → annule le drapeau optimiste, UNIQUEMENT sur la ligne
    // qui référence CE refund (anti-clobber + idempotent). On CONSERVE
    // `stripe_refund_id` (trace d'audit du refund qui a échoué) ; le commerçant
    // pourra relancer un remboursement (nouvelle tentative = nouvel id).
    const { data, error } = await db
      .from("orders")
      .update({ refunded: false, refunded_at: null })
      .eq("stripe_refund_id", refundId)
      .eq("refunded", true)
      .select("id");
    if (error) {
      reportError(error, { where: "reconcileRefundEvent", status, refundId });
      return { action: "noop" };
    }
    const rows = Array.isArray(data) ? data.length : 0;
    if (rows === 0) return { action: "noop" };
    return { action: "reverted", ...(orderId ? { orderId } : {}) };
  } catch (e) {
    // Colonnes 0047 absentes ou toute autre panne : avalé (webhook → 200).
    reportError(e, { where: "reconcileRefundEvent" });
    return { action: "noop" };
  }
}
