import { NextRequest } from "next/server";
import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Active / désactive l'encaissement en ligne des commandes. Interdit tant que
 * le compte Stripe du commerçant n'est pas prêt (charges activées).
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

  if (enabled) {
    // Vérifie que le compte Stripe est bien prêt avant d'autoriser.
    let ready = false;
    try {
      const { data } = await db
        .from("businesses")
        .select("stripe_account_ready")
        .eq("id", business.id)
        .maybeSingle();
      ready = !!(data as any)?.stripe_account_ready;
    } catch {
      ready = false;
    }
    if (!ready) {
      return Response.json({ error: "connect_first" }, { status: 400 });
    }
  }

  const { error } = await db
    .from("businesses")
    .update({ online_payment: enabled })
    .eq("id", business.id);
  if (error) {
    return Response.json({ error: "not_ready" }, { status: 409 });
  }
  return Response.json({ ok: true, enabled });
}
