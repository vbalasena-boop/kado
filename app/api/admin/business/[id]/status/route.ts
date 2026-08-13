import { NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin-guard";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Active ou suspend un établissement (donne / retire l'accès). */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: "forbidden" }, { status: 403 });

  let body: { status?: string; subscription_status?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const patch: Record<string, string> = {};
  if (body.status && ["active", "suspended"].includes(body.status)) {
    patch.status = body.status;
    // suspendre l'accès suspend aussi l'abonnement ; réactiver le repasse actif
    patch.subscription_status =
      body.status === "suspended" ? "suspended" : "active";
  }
  if (
    body.subscription_status &&
    ["trial", "active", "suspended"].includes(body.subscription_status)
  ) {
    patch.subscription_status = body.subscription_status;
  }
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "nothing_to_update" }, { status: 400 });
  }

  const db = getAdminClient();
  const { error } = await db
    .from("businesses")
    .update(patch)
    .eq("id", params.id);
  if (error) return Response.json({ error: "update_failed" }, { status: 500 });

  return Response.json({ ok: true });
}
