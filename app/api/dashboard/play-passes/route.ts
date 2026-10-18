import { NextRequest } from "next/server";
import { z } from "zod";
import { revalidateTag } from "next/cache";
import { getMyBusiness, hasAccess, hasModule } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { generatePlayPassCode, hashPlayPassCode } from "@/lib/play-pass";
import { hashRateLimitKey, rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate"), count: z.number().int().min(1).max(100) }),
  z.object({ action: z.literal("set-required"), required: z.boolean() }),
]);

async function businessContext() {
  const { user, business } = await getMyBusiness();
  if (!user || !business) return { error: Response.json({ error: "not_authenticated" }, { status: 401 }) };
  if (!hasAccess(business) || !hasModule(business, "roue")) {
    return { error: Response.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { business };
}

export async function GET() {
  const ctx = await businessContext();
  if ("error" in ctx) return ctx.error;
  const admin = getAdminClient();
  const [{ data: config, error: configError }, { count, error: countError }] = await Promise.all([
    admin.from("wheel_configs").select("play_pass_required").eq("business_id", ctx.business.id).maybeSingle(),
    admin.from("play_passes").select("id", { count: "exact", head: true })
      .eq("business_id", ctx.business.id).is("redeemed_at", null).gt("expires_at", new Date().toISOString()),
  ]);
  if (configError || countError) {
    return Response.json({ error: "play_passes_unavailable" }, { status: 503 });
  }
  return Response.json({ required: !!config?.play_pass_required, available: count ?? 0 });
}

export async function POST(req: NextRequest) {
  const ctx = await businessContext();
  if ("error" in ctx) return ctx.error;
  const ip = clientIp(req);
  if (!(await rateLimit(`play-pass-admin:${ctx.business.id}:${hashRateLimitKey(ip)}`, 10, 60))) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const admin = getAdminClient();
  if (body.action === "set-required") {
    if (body.required) {
      const { count, error } = await admin.from("play_passes").select("id", { count: "exact", head: true })
        .eq("business_id", ctx.business.id).is("redeemed_at", null).gt("expires_at", new Date().toISOString());
      if (error) return Response.json({ error: "play_passes_unavailable" }, { status: 503 });
      if (!count) return Response.json({ error: "no_available_passes" }, { status: 409 });
    }
    const { error } = await admin.from("wheel_configs").update({ play_pass_required: body.required })
      .eq("business_id", ctx.business.id);
    if (error) return Response.json({ error: "settings_unavailable" }, { status: 503 });
    revalidateTag(`biz-${ctx.business.slug}`);
    return Response.json({ required: body.required });
  }

  const codes = Array.from({ length: body.count }, generatePlayPassCode);
  const rows = codes.map((code) => ({ business_id: ctx.business.id, code_hash: hashPlayPassCode(code) }));
  const { error } = await admin.from("play_passes").insert(rows);
  if (error) return Response.json({ error: "generation_failed" }, { status: 503 });
  return Response.json({ codes, expiresInDays: 90 });
}
