import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser, ACTIVE_BIZ_COOKIE } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Change l'établissement actif (multi-établissements). */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "not_authenticated" }, { status: 401 });

  let body: { businessId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const businessId = (body.businessId || "").trim();
  if (!businessId) return Response.json({ error: "bad_request" }, { status: 400 });

  // Sécurité : l'établissement doit appartenir au commerçant connecté.
  const { data } = await getAdminClient()
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!data) return Response.json({ error: "not_found" }, { status: 404 });

  cookies().set(ACTIVE_BIZ_COOKIE, businessId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return Response.json({ ok: true });
}
