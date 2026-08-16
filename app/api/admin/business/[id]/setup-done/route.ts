import { NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin-guard";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Marque l'installation clé en main d'un établissement comme réalisée. */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: "forbidden" }, { status: 403 });

  const db = getAdminClient();
  const { error } = await db
    .from("businesses")
    .update({ setup_done_at: new Date().toISOString() })
    .eq("id", params.id);
  if (error) return Response.json({ error: "update_failed" }, { status: 500 });

  return Response.json({ ok: true });
}
