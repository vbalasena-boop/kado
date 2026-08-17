import { NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin-guard";
import { getAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Supprime définitivement un COMPTE complet :
 * 1. résilie l'abonnement Stripe (plus aucun prélèvement),
 * 2. supprime l'établissement (roue, cadeaux, tours, cartes, commandes… en cascade),
 * 3. supprime le compte de connexion du commerçant s'il ne possède
 *    aucun autre établissement.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: "forbidden" }, { status: 403 });

  const db = getAdminClient();
  const { data: biz } = await db
    .from("businesses")
    .select("id, stripe_subscription_id, owner_user_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!biz) return Response.json({ error: "not_found" }, { status: 404 });

  // 1) Résilier l'abonnement Stripe (best effort — jamais bloquant)
  let stripeCancelled = false;
  if (biz.stripe_subscription_id) {
    try {
      await getStripe().subscriptions.cancel(biz.stripe_subscription_id);
      stripeCancelled = true;
    } catch {
      /* déjà résilié ou introuvable : on continue */
    }
  }

  // 2) Supprimer l'établissement (cascade sur toutes les données liées)
  const { error } = await db.from("businesses").delete().eq("id", params.id);
  if (error) return Response.json({ error: "delete_failed" }, { status: 500 });

  // 3) Supprimer le compte de connexion s'il n'a plus d'établissement
  let userDeleted = false;
  if (biz.owner_user_id) {
    try {
      const { count } = await db
        .from("businesses")
        .select("*", { count: "exact", head: true })
        .eq("owner_user_id", biz.owner_user_id);
      if ((count ?? 0) === 0) {
        await db.auth.admin.deleteUser(biz.owner_user_id);
        userDeleted = true;
      }
    } catch {
      /* compte déjà supprimé : ignore */
    }
  }

  return Response.json({ ok: true, stripeCancelled, userDeleted });
}
