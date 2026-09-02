import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Remet les compteurs d'un établissement à zéro : supprime tous les tours
 * joués (et leurs codes cadeaux) ET les commandes Click & collect (stats de
 * vente). Les cartes de fidélité, e-mails capturés et le catalogue produits
 * sont conservés. Utile après une installation/des tests.
 */
export const POST = adminRoute({
  handler: async ({ params }) => {
    const db = getAdminClient();
    const { error, count } = await db
      .from("plays")
      .delete({ count: "exact" })
      .eq("business_id", params.id);
    if (error) return Response.json({ error: "delete_failed" }, { status: 500 });

    // Commandes Click & collect (tolérant si la table n'existe pas encore)
    let orders = 0;
    try {
      const { error: oErr, count: oCount } = await db
        .from("orders")
        .delete({ count: "exact" })
        .eq("business_id", params.id);
      if (!oErr) orders = oCount ?? 0;
    } catch {
      /* table absente */
    }

    // Rafraîchit immédiatement le cache des stats admin (0068) : sans cela, le
    // tableau de bord continuerait d'afficher les anciens totaux jusqu'au
    // prochain cron quotidien. Best-effort : ignoré si la fonction n'est pas
    // encore déployée.
    try {
      await db.rpc("refresh_admin_stats");
    } catch {
      /* fonction absente : le cron rafraîchira le cache */
    }

    return Response.json({ ok: true, deleted: count ?? 0, orders });
  },
});
