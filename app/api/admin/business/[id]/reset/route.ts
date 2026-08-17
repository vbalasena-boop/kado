import { NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin-guard";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Remet les compteurs d'un établissement à zéro : supprime tous les tours
 * joués (et leurs codes cadeaux) ET les commandes Click & collect (stats de
 * vente). Les cartes de fidélité, e-mails capturés et le catalogue produits
 * sont conservés. Utile après une installation/des tests.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: "forbidden" }, { status: 403 });

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

  return Response.json({ ok: true, deleted: count ?? 0, orders });
}
