import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { isValidDeviceHash } from "@/lib/device-hash";

export const dynamic = "force-dynamic";

const VALID_TYPES = ["instagram", "review"];

/**
 * Récupère les tours déjà joués par un APPAREIL (via son empreinte).
 * Permet de réafficher le cadeau + code d'un joueur même si son cookie a
 * disparu (navigation privée / cookies vidés / autre navigateur, même appareil).
 * Lecture seule. Renvoie { played: { instagram?: {label, code}, review?: {...} } }.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!(await rateLimit(`myplays:${ip}`, 30, 60))) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: { slug?: string; deviceHash?: string | null };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  // Sans empreinte valide, rien à récupérer (repli silencieux).
  if (!body.slug || !isValidDeviceHash(body.deviceHash)) {
    return Response.json({ played: {} });
  }

  const supa = getAdminClient();
  const { data: biz } = await supa
    .from("businesses")
    .select("id, status")
    .eq("slug", body.slug)
    .maybeSingle();
  if (!biz || biz.status !== "active") {
    return Response.json({ played: {} });
  }

  const { data: rows, error } = await supa
    .from("plays")
    .select("play_type, prize_label, prize_code")
    .eq("business_id", biz.id)
    .eq("device_hash", body.deviceHash);
  // Colonne device_hash absente (migration 0041 non appliquée) → rien à faire.
  if (error) return Response.json({ played: {} });

  const played: Record<string, { label: string; code: string }> = {};
  for (const r of rows ?? []) {
    if (VALID_TYPES.includes(r.play_type)) {
      played[r.play_type] = { label: r.prize_label, code: r.prize_code };
    }
  }
  return Response.json({ played });
}
