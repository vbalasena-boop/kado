import { NextRequest } from "next/server";
import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Enregistre la configuration de roue du commerçant connecté. */
export async function POST(req: NextRequest) {
  const { business } = await getMyBusiness();
  if (!business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: {
    config?: {
      primary_color?: string;
      instagram_url?: string;
      review_url?: string;
      compliance_note?: string;
      daily_prize_limit?: number | null;
    };
    prizes?: {
      label: string;
      emoji: string;
      weight: number;
      color: string;
    }[];
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const admin = getAdminClient();
  const cfg = body.config ?? {};

  // upsert config (1-1 avec business)
  const { error: cfgErr } = await admin.from("wheel_configs").upsert(
    {
      business_id: business.id,
      primary_color: cfg.primary_color || "#ffc24d",
      instagram_url: cfg.instagram_url || null,
      review_url: cfg.review_url || null,
      compliance_note:
        cfg.compliance_note || "Le cadeau n'est pas conditionné à la note laissée.",
      daily_prize_limit:
        cfg.daily_prize_limit && cfg.daily_prize_limit > 0
          ? Math.round(cfg.daily_prize_limit)
          : null,
    },
    { onConflict: "business_id" }
  );
  if (cfgErr) return Response.json({ error: "config_error" }, { status: 500 });

  // remplace la liste des cadeaux
  const prizes = (body.prizes ?? [])
    .filter((p) => p.label && p.label.trim())
    .slice(0, 20);
  if (prizes.length === 0) {
    return Response.json({ error: "no_prizes" }, { status: 400 });
  }

  await admin.from("prizes").delete().eq("business_id", business.id);
  const { error: insErr } = await admin.from("prizes").insert(
    prizes.map((p, i) => ({
      business_id: business.id,
      label: p.label.trim().slice(0, 40),
      emoji: (p.emoji || "🎁").slice(0, 8),
      weight: Math.max(0, Math.round(Number(p.weight) || 0)),
      color: /^#[0-9a-fA-F]{6}$/.test(p.color) ? p.color : "#ff5d73",
      position: i,
    }))
  );
  if (insErr) return Response.json({ error: "prizes_error" }, { status: 500 });

  return Response.json({ ok: true });
}
