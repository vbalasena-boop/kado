import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { hasAccess } from "@/lib/auth";
import { beeperPilot } from "@/lib/beeper";
import { clientIp, hashRateLimitKey } from "@/lib/rate-limit";

const cookie = "kado-beeper-device";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function handle(req: NextRequest, ctx: { params: Promise<{ slug: string }> }, create: boolean) {
  const { slug } = await ctx.params;
  if (!beeperPilot(slug)) return reply({ error: "Beeper indisponible." }, 404);
  if (create && req.headers.get("origin") && req.headers.get("origin") !== req.nextUrl.origin) return reply({ error: "Origine refusée." }, 403);
  try {
    const db = getAdminClient();
    const { data: biz, error: bizError } = await db.from("businesses").select("id,status,subscription_ends_at").eq("slug", slug).maybeSingle();
    if (bizError) throw bizError;
    if (!biz || !hasAccess(biz)) return reply({ error: "Beeper indisponible." }, 404);
    const existing = req.cookies.get(cookie)?.value;
    const device = existing && /^[0-9a-f-]{36}$/.test(existing) ? existing : randomUUID();
    const deviceKey = hashRateLimitKey(`beeper-device:${biz.id}:${device}`);
    if (!create) {
      const { data, error } = await db.from("beeper_orders").select("id,number,status")
        .eq("business_id", biz.id).eq("device_key", deviceKey)
        .gte("created_at", new Date(Date.now() - 86400000).toISOString())
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return reply({ order: data });
    }
    const { data, error } = await db.rpc("claim_beeper", {
      biz: biz.id, device: deviceKey, ip: hashRateLimitKey(`beeper-ip:${biz.id}:${clientIp(req)}`),
    });
    if (error?.message.includes("beeper_limit")) return reply({ error: "Limite atteinte : trois beepers par heure et par appareil ou connexion. Réessayez plus tard." }, 429);
    if (error) throw error;
    const response = reply({ order: data[0] });
    response.cookies.set(cookie, device, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 86400 });
    return response;
  } catch {
    return reply({ error: "Service indisponible. Réessayez dans un instant." }, 503);
  }
}
export const POST = (req: NextRequest, ctx: { params: Promise<{ slug: string }> }) => handle(req, ctx, true);
export const GET = (req: NextRequest, ctx: { params: Promise<{ slug: string }> }) => handle(req, ctx, false);
