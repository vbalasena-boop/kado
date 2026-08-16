import { NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin-guard";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Enregistre la note interne d'un établissement (admin uniquement). */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: "forbidden" }, { status: 403 });

  let body: { note?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const note = (body.note ?? "").trim().slice(0, 500) || null;
  const { error } = await getAdminClient()
    .from("businesses")
    .update({ admin_note: note })
    .eq("id", params.id);
  if (error) return Response.json({ error: "update_failed" }, { status: 500 });

  return Response.json({ ok: true });
}
