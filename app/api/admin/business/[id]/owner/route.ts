import { NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin-guard";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Change le propriétaire d'un établissement (invite/retrouve l'utilisateur par e-mail). */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: "forbidden" }, { status: 403 });

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const email = (body.email || "").trim().toLowerCase();
  if (!email) return Response.json({ error: "email_required" }, { status: 400 });

  const db = getAdminClient();
  const origin = new URL(req.url).origin;

  // invite / retrouve l'utilisateur
  let ownerId: string | null = null;
  let warning: string | null = null;
  try {
    const { data: invited, error } = await db.auth.admin.inviteUserByEmail(
      email,
      { redirectTo: `${origin}/auth/callback` }
    );
    if (invited?.user) ownerId = invited.user.id;
    else if (error) {
      const { data: list } = await db.auth.admin.listUsers();
      const found = list?.users.find(
        (u: any) => u.email?.toLowerCase() === email
      );
      if (found) ownerId = found.id;
    }
  } catch {
    /* on tente quand même de retrouver l'utilisateur ci-dessous */
  }

  if (!ownerId) {
    // dernière tentative : l'utilisateur existe peut-être déjà
    const { data: list } = await db.auth.admin.listUsers();
    const found = list?.users.find(
      (u: any) => u.email?.toLowerCase() === email
    );
    if (found) ownerId = found.id;
  }

  if (!ownerId) {
    return Response.json(
      { error: "Utilisateur introuvable (l'invitation n'a pas pu être envoyée)." },
      { status: 400 }
    );
  }

  const { error: upErr } = await db
    .from("businesses")
    .update({ owner_user_id: ownerId })
    .eq("id", params.id);
  if (upErr) return Response.json({ error: "update_failed" }, { status: 500 });

  return Response.json({ ok: true, warning });
}
