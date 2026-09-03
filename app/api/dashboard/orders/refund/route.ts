import { z } from "zod";
import { merchantRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { performOrderRefund } from "@/lib/order-refund";

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

    // Compte de la charge directe (0075), lu À PART : le select ci-dessus est
    // volontairement fail-closed, l'y ajouter bloquerait tout remboursement
    // tant que la migration n'est pas appliquée. Absent → `performOrderRefund`
    // retombe sur sa détection automatique.
    try {
      const { data: acc } = await db
        .from("orders")
        .select("stripe_account_id")
        .eq("id", id)
        .eq("business_id", business.id)
        .maybeSingle();
      order.stripe_account_id =
        (acc as { stripe_account_id?: string | null } | null)
          ?.stripe_account_id ?? null;
    } catch {
      /* colonne 0075 absente : détection automatique côté performOrderRefund */
    }

    // Cœur d'effets partagé (extrait pour la story 11.2) : éligibilité →
    // PaymentIntent → refund plateforme idempotent → drapeau remboursé. Ne jette
    // jamais ; on mappe l'`outcome` structuré vers la sémantique HTTP inchangée.
    // `business_id` fourni depuis `business.id` (isolation multi-tenant).
    const outcome = await performOrderRefund(db, getStripe(), {
      ...order,
      business_id: business.id,
    });

    switch (outcome.status) {
      case "refunded":
        return Response.json({
          ok: true,
          refunded: true,
          stripe_refund_id: outcome.stripeRefundId,
          order: { code: order.code, total_cents: order.total_cents },
        });
      case "skipped": {
        const detail =
          outcome.code === "already_refunded"
            ? "Cette commande a déjà été remboursée."
            : "Cette commande n'a pas été payée en ligne — rien à rembourser.";
        return Response.json({ error: outcome.code, detail }, { status: 400 });
      }
      case "no_payment_intent":
        return Response.json(
          {
            error: "no_payment_intent",
            detail: "Paiement Stripe introuvable pour cette commande.",
          },
          { status: 400 }
        );
      case "failed":
        return Response.json(
          { error: "refund_failed", detail: `Stripe : ${outcome.detail}` },
          { status: 502 }
        );
      case "record_failed":
        // Le refund Stripe A RÉUSSI : on ne renvoie pas d'échec silencieux. La
        // clé d'idempotence empêche un double refund à la reprise.
        return Response.json(
          {
            error: "refund_recorded_partially",
            detail:
              "Remboursement Stripe effectué mais l'état n'a pu être enregistré (migration 0047 ?).",
            stripe_refund_id: outcome.stripeRefundId,
          },
          { status: 502 }
        );
      default: {
        // Exhaustivité : si une nouvelle variante de RefundOutcome apparaît, la
        // compilation échoue ici (garde-fou chemin argent).
        const _never: never = outcome;
        return Response.json({ error: "refund_failed", _never }, { status: 500 });
      }
    }
  },
});
