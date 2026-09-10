import { z } from "zod";
import { merchantRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { normalizeOrderDomain, normalizeWebsiteUrl } from "@/lib/order-domain";

export const dynamic = "force-dynamic";

const Body = z.object({
  websiteUrl: z.string().max(300).nullable().optional(),
  orderDomain: z.string().max(253).nullable().optional(),
});

/**
 * Enregistre le site du commerçant (lien « Retour au site ») et le
 * sous-domaine de commande (commander.<son-domaine>). Chaîne vide = effacer.
 */
export const POST = merchantRoute({
  requireActive: true,
  requireClickCollect: true,
  schema: Body,
  handler: async ({ body, business }) => {
    const rawSite = (body.websiteUrl ?? "").trim();
    const rawDomain = (body.orderDomain ?? "").trim();

    const websiteUrl = rawSite ? normalizeWebsiteUrl(rawSite) : null;
    if (rawSite && !websiteUrl) {
      return Response.json(
        { error: "invalid_website", detail: "Adresse de site invalide." },
        { status: 400 }
      );
    }
    const orderDomain = rawDomain ? normalizeOrderDomain(rawDomain) : null;
    if (rawDomain && !orderDomain) {
      return Response.json(
        {
          error: "invalid_domain",
          detail:
            "Domaine invalide. Exemple attendu : commander.mon-commerce.fr",
        },
        { status: 400 }
      );
    }

    const { error } = await getAdminClient()
      .from("businesses")
      .update({ website_url: websiteUrl, order_domain: orderDomain })
      .eq("id", business.id);
    if (error) {
      if (error.code === "23505") {
        return Response.json(
          {
            error: "domain_taken",
            detail: "Ce domaine est déjà utilisé par un autre commerce.",
          },
          { status: 409 }
        );
      }
      return Response.json(
        { error: "save_failed", detail: error.message },
        { status: 500 }
      );
    }
    return Response.json({ ok: true, websiteUrl, orderDomain });
  },
});
