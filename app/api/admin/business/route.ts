import { NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin-guard";
import { getAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_PRIZES, slugify } from "@/lib/defaults";
import { insertPrizes } from "@/lib/prizes";

export const dynamic = "force-dynamic";

/** Crée un établissement, invite le commerçant, génère roue + cadeaux par défaut. */
export async function POST(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: "forbidden" }, { status: 403 });

  let body: { name?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const name = (body.name || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  if (!name || !email) {
    return Response.json({ error: "name_email_required" }, { status: 400 });
  }

  const db = getAdminClient();
  const origin = new URL(req.url).origin;

  // 1) slug unique
  let base = slugify(name);
  let slug = base;
  for (let i = 2; i < 100; i++) {
    const { data: exists } = await db
      .from("businesses")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!exists) break;
    slug = `${base}-${i}`;
  }

  // 2) invite / retrouve l'utilisateur commerçant
  let ownerId: string | null = null;
  let warning: string | null = null;
  try {
    const { data: invited, error } = await db.auth.admin.inviteUserByEmail(
      email,
      { redirectTo: `${origin}/auth/callback` }
    );
    if (invited?.user) ownerId = invited.user.id;
    else if (error) {
      // déjà inscrit ? on le retrouve
      const { data: list } = await db.auth.admin.listUsers();
      const found = list?.users.find(
        (u: any) => u.email?.toLowerCase() === email
      );
      if (found) ownerId = found.id;
      else warning = "invitation e-mail non envoyée (vérifiez la config SMTP).";
    }
  } catch {
    warning = "invitation e-mail non envoyée (vérifiez la config Auth).";
  }

  // 3) crée l'établissement (essai gratuit de 14 jours)
  const trialEnds = new Date(Date.now() + 14 * 864e5).toISOString();
  const { data: biz, error: bizErr } = await db
    .from("businesses")
    .insert({
      slug,
      name,
      status: "active",
      subscription_status: "trial",
      subscription_ends_at: trialEnds,
      owner_user_id: ownerId,
    })
    .select("id")
    .single();
  if (bizErr || !biz) {
    return Response.json({ error: "create_failed" }, { status: 500 });
  }

  // 4) config + cadeaux par défaut
  await db.from("wheel_configs").insert({
    business_id: biz.id,
    primary_color: "#ffc24d",
    compliance_note: "Le cadeau n'est pas conditionné à la note laissée.",
  });
  await insertPrizes(
    db,
    DEFAULT_PRIZES.map((p, i) => ({ ...p, business_id: biz.id, position: i }))
  );

  return Response.json({ ok: true, slug, warning });
}
