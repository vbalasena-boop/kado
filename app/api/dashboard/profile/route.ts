import { NextRequest } from "next/server";
import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Met à jour les coordonnées du commerce (adresse, téléphone). */
export async function POST(req: NextRequest) {
  const { business } = await getMyBusiness();
  if (!business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: { address?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const patch: Record<string, string> = {};
  if (typeof body.address === "string") {
    const a = body.address.trim().slice(0, 200);
    if (a) patch.address = a;
  }
  if (typeof body.phone === "string") {
    const p = body.phone.replace(/[^\d+ .-]/g, "").trim().slice(0, 20);
    if (p) patch.phone = p;
  }
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "nothing_to_update" }, { status: 400 });
  }

  const { error } = await getAdminClient()
    .from("businesses")
    .update(patch)
    .eq("id", business.id);
  if (error) return Response.json({ error: "update_failed" }, { status: 500 });

  return Response.json({ ok: true });
}
