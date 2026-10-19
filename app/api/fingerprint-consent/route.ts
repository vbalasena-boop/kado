import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";
import { getOrCreatePlayerId, readPlayerId } from "@/lib/player";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { FINGERPRINT_CONSENT_VERSION } from "@/lib/fingerprint-consent";

export const dynamic = "force-dynamic";

const Choice = z.object({ slug: z.string().min(1).max(100), consented: z.boolean() });

async function activeBusiness(slug: string) {
  const { data } = await getAdminClient()
    .from("businesses")
    .select("id, status")
    .eq("slug", slug)
    .maybeSingle();
  return data?.status === "active" ? data : null;
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  if (!slug) return Response.json({ consented: false });
  const [biz, playerId] = await Promise.all([
    activeBusiness(slug),
    readPlayerId(),
  ]);
  if (!biz || !playerId) return Response.json({ consented: false });
  const { data, error } = await getAdminClient()
    .from("player_fingerprint_consents")
    .select("consented, policy_version")
    .eq("business_id", biz.id)
    .eq("player_id", playerId)
    .maybeSingle();
  return Response.json({
    consented: !error && data?.consented === true && data.policy_version === FINGERPRINT_CONSENT_VERSION,
  });
}

export async function POST(req: NextRequest) {
  if (!(await rateLimit(`fingerprint-consent:${clientIp(req)}`, 20, 60))) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }
  let body: z.infer<typeof Choice>;
  try {
    body = Choice.parse(await req.json());
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const biz = await activeBusiness(body.slug);
  if (!biz) return Response.json({ error: "unavailable" }, { status: 404 });
  const playerId = await getOrCreatePlayerId();
  const supa = getAdminClient();
  const { error } = await supa.from("player_fingerprint_consents").upsert({
    business_id: biz.id,
    player_id: playerId,
    consented: body.consented,
    policy_version: FINGERPRINT_CONSENT_VERSION,
    updated_at: new Date().toISOString(),
  }, { onConflict: "business_id,player_id" });
  if (error) return Response.json({ error: "consent_unavailable" }, { status: 503 });

  // Withdrawal stops further recovery and removes previously stored hashes
  // associated with this signed player identity.
  if (!body.consented) {
    const { error: eraseError } = await supa.from("plays")
      .update({ device_hash: null })
      .eq("business_id", biz.id)
      .eq("player_id", playerId);
    // Older deployments may not have the optional device_hash column yet.
    if (eraseError && (eraseError as { code?: string }).code !== "42703") {
      return Response.json({ error: "consent_update_incomplete" }, { status: 503 });
    }
  }
  return Response.json({ consented: body.consented });
}
