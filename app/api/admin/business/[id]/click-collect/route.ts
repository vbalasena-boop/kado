import { NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin-guard";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Active/désactive le module Click & collect pour un établissement.
 * Réservé à l'admin : le commerçant ne peut pas l'activer lui-même (bêta).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: "forbidden" }, { status: 403 });

  let body: { enable?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const { error } = await getAdminClient()
    .from("businesses")
    .update({ click_collect: !!body.enable })
    .eq("id", params.id);
  if (error) {
    return Response.json(
      { error: "update_failed", detail: error.message },
      { status: 500 }
    );
  }

  return Response.json({ ok: true, enabled: !!body.enable });
}
