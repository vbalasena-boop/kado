import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { OPTIONAL_FEATURES, normalizeFeatures } from "@/lib/features";

export const dynamic = "force-dynamic";

/**
 * « Tout activer » sur un établissement (réservé admin).
 *
 * Prépare un établissement entièrement équipé (utile pour vendre un compte
 * clés en main) : formule Complet + toutes les options + toutes les bascules
 * de la page de jeu + toutes les fonctions avancées.
 *
 * Ne touche PAS l'abonnement (essai/dates) ni le drapeau démo : c'est géré
 * séparément (« Passer en essai », « Offrir des mois »). Le paiement en ligne
 * n'est pas activé (il exige un compte Stripe Connect prêt).
 *
 * Chaque bloc est appliqué indépendamment et de façon tolérante.
 */
const WHEEL_ALL = {
  instagram_enabled: true,
  review_enabled: true,
  loyalty_enabled: true,
  birthday_enabled: true,
  referral_enabled: true,
  play_alerts: true,
  monthly_draw: true,
  reengage_almost: true,
  reengage_inactive: true,
  reengage_reward: true,
  review_invite: true,
  convert_nudge: true,
  feedback_enabled: true,
};

export const POST = adminRoute({
  handler: async ({ params }) => {
    const db = getAdminClient();
    const applied: string[] = [];
    const skipped: string[] = [];

    // 1) Formule complète + options (colonnes de longue date).
    {
      const { error } = await db
        .from("businesses")
        .update({
          plan: "complet",
          campaigns_addon: true,
          click_collect: true,
          order_tracking: true,
        })
        .eq("id", params.id);
      if (error) skipped.push("plan/options");
      else applied.push("plan/options");
    }

    // 2) Fonctions avancées (businesses.features jsonb — 0072).
    {
      const all = normalizeFeatures(
        Object.fromEntries(OPTIONAL_FEATURES.map((f) => [f.key, true]))
      );
      const { error } = await db
        .from("businesses")
        .update({ features: all })
        .eq("id", params.id);
      if (error) skipped.push("features");
      else applied.push("features");
    }

    // 3) Toutes les bascules de la page de jeu. On préserve le lot du tirage
    // périodique s'il est déjà renseigné (sinon un libellé par défaut).
    {
      let prize = "Un cadeau surprise";
      try {
        const { data } = await db
          .from("wheel_configs")
          .select("monthly_draw_prize")
          .eq("business_id", params.id)
          .maybeSingle();
        const existing = (data as { monthly_draw_prize?: string | null } | null)
          ?.monthly_draw_prize;
        if (existing) prize = existing;
      } catch {
        /* colonne absente : on garde le défaut */
      }
      const { error } = await db
        .from("wheel_configs")
        .update({ ...WHEEL_ALL, monthly_draw_prize: prize })
        .eq("business_id", params.id);
      if (error) skipped.push("wheel");
      else applied.push("wheel");
    }

    return Response.json({ ok: true, applied, skipped });
  },
});
