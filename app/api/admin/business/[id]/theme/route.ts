import { NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin-guard";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const hex = (v: string | null | undefined, def: string) =>
  v && /^#[0-9a-fA-F]{6}$/.test(v) ? v : def;

/**
 * Personnalisation de la page de jeu d'un établissement par l'admin
 * (formule « Installation clé en main »).
 *  - POST { primary, accent, bg, decor } → applique + verrouille (theme_locked)
 *  - POST { unlock: true }               → rend la main au commerçant (3 thèmes)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: "forbidden" }, { status: 403 });

  let body: {
    primary?: string;
    accent?: string;
    bg?: string;
    decor?: string;
    unlock?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const db = getAdminClient();

  // Déverrouillage : le commerçant retrouve le choix des 3 thèmes.
  if (body.unlock) {
    const { error } = await db
      .from("wheel_configs")
      .update({ theme_locked: false })
      .eq("business_id", params.id);
    if (error)
      return Response.json({ error: "update_failed", detail: error.message }, { status: 500 });
    return Response.json({ ok: true, locked: false });
  }

  const payload: Record<string, unknown> = {
    business_id: params.id,
    primary_color: hex(body.primary, "#ffc24d"),
    accent_color: hex(body.accent, "#ff5d73"),
    bg_color: hex(body.bg, "#150c29"),
    theme_locked: true,
    decor_emojis: (body.decor || "").trim().slice(0, 40) || null,
  };

  let { error } = await db
    .from("wheel_configs")
    .upsert(payload, { onConflict: "business_id" });
  // Migrations récentes absentes : réessaie sans les colonnes manquantes.
  if (error && /decor_emojis/.test(error.message)) {
    delete payload.decor_emojis;
    ({ error } = await db
      .from("wheel_configs")
      .upsert(payload, { onConflict: "business_id" }));
  }
  if (error && /theme_locked/.test(error.message)) {
    delete payload.theme_locked;
    ({ error } = await db
      .from("wheel_configs")
      .upsert(payload, { onConflict: "business_id" }));
  }
  if (error)
    return Response.json(
      { error: "update_failed", detail: error.message },
      { status: 500 }
    );

  return Response.json({ ok: true, locked: true });
}
