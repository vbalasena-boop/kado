import { z } from "zod";
import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Bascule le mode « démo » d'un établissement (réservé admin).
 *
 *   - enable = true  : marque l'établissement comme DÉMO (exclu des stats).
 *   - enable = false : « passe en essai » — retire la démo ET démarre un essai
 *     de 14 jours à partir de maintenant (le compte devient un vrai client).
 *
 * Écritures tolérantes : si la colonne `demo` (0073) n'existe pas encore, la
 * mise à jour échoue proprement (renvoyée dans `error`) sans planter.
 */
const Body = z.object({
  enable: z.boolean(),
});

export const POST = adminRoute({
  schema: Body,
  handler: async ({ body, params }) => {
    const db = getAdminClient();

    if (body.enable) {
      // Marquer comme démo.
      const { error } = await db
        .from("businesses")
        .update({ demo: true })
        .eq("id", params.id);
      if (error) {
        return Response.json(
          { error: "update_failed", detail: error.message },
          { status: 500 }
        );
      }
      return Response.json({ ok: true, demo: true });
    }

    // Passer en essai : retirer la démo + repartir sur 14 jours d'essai.
    const ends = new Date(Date.now() + 14 * 864e5).toISOString();
    const { error } = await db
      .from("businesses")
      .update({
        demo: false,
        subscription_status: "trial",
        subscription_ends_at: ends,
        status: "active",
      })
      .eq("id", params.id);
    if (error) {
      return Response.json(
        { error: "update_failed", detail: error.message },
        { status: 500 }
      );
    }
    return Response.json({ ok: true, demo: false, subscription_ends_at: ends });
  },
});
