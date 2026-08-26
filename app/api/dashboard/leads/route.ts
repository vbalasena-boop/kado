import { merchantRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { LEADS_PAGE_SIZE } from "@/lib/leads-csv";

export const dynamic = "force-dynamic";

/**
 * Liste paginée des contacts collectés du commerçant connecté.
 * `?offset=` (défaut 0). Renvoie `{ leads, total }` — total au 1er appel pour
 * afficher le compteur ; la page ne charge plus toute la base d'un coup.
 */
export const GET = merchantRoute({
  handler: async ({ req, business }) => {
    const offset = Math.max(
      0,
      Math.floor(Number(req.nextUrl.searchParams.get("offset")) || 0)
    );
    const admin = getAdminClient();
    const { data, count, error } = await admin
      .from("leads")
      .select("email, phone, created_at", { count: "exact" })
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + LEADS_PAGE_SIZE - 1);
    if (error) {
      return Response.json({ error: "load_failed" }, { status: 500 });
    }
    return Response.json({ leads: data ?? [], total: count ?? 0 });
  },
});
