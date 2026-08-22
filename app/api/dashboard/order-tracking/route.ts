import { NextRequest } from "next/server";
import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Active / désactive l'option « Suivi client au comptoir » (bipeur digital +
 * commande caisse) pour le commerce connecté.
 */
export async function POST(req: NextRequest) {
  const { business } = await getMyBusiness();
  if (!business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }
  let body: { enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const enabled = !!body.enabled;

  const db = getAdminClient();
  const { error } = await db
    .from("businesses")
    .update({ order_tracking: enabled })
    .eq("id", business.id);
  if (error) {
    // colonne absente : migration 0039 non appliquée
    return Response.json({ error: "not_ready" }, { status: 409 });
  }
  return Response.json({ ok: true, enabled });
}
