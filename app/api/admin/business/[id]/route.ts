import { NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin-guard";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Supprime définitivement un établissement (et ses données liées, en cascade). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: "forbidden" }, { status: 403 });

  const db = getAdminClient();
  const { error } = await db.from("businesses").delete().eq("id", params.id);
  if (error) return Response.json({ error: "delete_failed" }, { status: 500 });

  return Response.json({ ok: true });
}
