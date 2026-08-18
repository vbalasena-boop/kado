import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser, ACTIVE_BIZ_COOKIE } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_PRIZES, slugify } from "@/lib/defaults";
import { reportError } from "@/lib/report";

export const dynamic = "force-dynamic";

const MAX_BUSINESSES = 20; // garde-fou anti-abus

/** Le commerçant ajoute lui-même un établissement (multi-boutiques). */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "not_authenticated" }, { status: 401 });

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const name = (body.name || "").trim().slice(0, 80);
  if (!name) return Response.json({ error: "name_required" }, { status: 400 });

  const db = getAdminClient();

  // Garde-fou : nombre d'établissements déjà rattachés au commerçant.
  const { count } = await db
    .from("businesses")
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", user.id);
  if ((count ?? 0) >= MAX_BUSINESSES) {
    return Response.json({ error: "too_many" }, { status: 400 });
  }

  try {
    // 1) slug unique
    const base = slugify(name) || "boutique";
    let slug = base;
    for (let i = 2; i < 200; i++) {
      const { data: exists } = await db
        .from("businesses")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!exists) break;
      slug = `${base}-${i}`;
    }

    // 2) crée l'établissement (essai gratuit de 14 jours)
    const trialEnds = new Date(Date.now() + 14 * 864e5).toISOString();
    const { data: biz, error: bizErr } = await db
      .from("businesses")
      .insert({
        slug,
        name,
        status: "active",
        subscription_status: "trial",
        subscription_ends_at: trialEnds,
        owner_user_id: user.id,
      })
      .select("id")
      .single();
    if (bizErr || !biz) {
      reportError(bizErr, { where: "add-business", slug });
      return Response.json({ error: "create_failed" }, { status: 500 });
    }

    // 3) config + cadeaux par défaut
    await db.from("wheel_configs").insert({
      business_id: biz.id,
      primary_color: "#ffc24d",
      compliance_note: "Le cadeau n'est pas conditionné à la note laissée.",
    });
    await db.from("prizes").insert(
      DEFAULT_PRIZES.map((p, i) => ({ ...p, business_id: biz.id, position: i }))
    );

    // 4) bascule tout de suite sur le nouvel établissement
    cookies().set(ACTIVE_BIZ_COOKIE, biz.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    return Response.json({ ok: true, slug });
  } catch (e) {
    reportError(e, { where: "add-business" });
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
