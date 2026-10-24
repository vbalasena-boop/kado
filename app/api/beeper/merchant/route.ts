import { z } from "zod";
import { merchantRoute } from "@/lib/api";
import { createSSRClient } from "@/lib/supabase/ssr";
import { beeperPilot, previousBeeperStatus } from "@/lib/beeper";

export const GET = merchantRoute({ handler: async ({ business }) => {
  if (!beeperPilot(business.slug)) return Response.json({ error: "Indisponible" }, { status: 404 });
  const db = await createSSRClient();
  const { data, error } = await db.from("beeper_orders").select("id,number,status,created_at")
    .eq("business_id", business.id).neq("status", "collected")
    .gte("created_at", new Date(Date.now() - 86400000).toISOString()).order("created_at");
  return Response.json(error ? { error: "Lecture impossible" } : { orders: data }, { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } });
} });
export const PATCH = merchantRoute({ schema: z.object({ id: z.string().uuid(), status: z.enum(["ready", "collected"]) }), handler: async ({ business, body, req }) => {
  if (req.headers.get("origin") && req.headers.get("origin") !== req.nextUrl.origin) return Response.json({ error: "Origine refusée" }, { status: 403 });
  if (!beeperPilot(business.slug)) return Response.json({ error: "Indisponible" }, { status: 404 });
  const db = await createSSRClient();
  const { data, error } = await db.from("beeper_orders").update({ status: body.status })
    .eq("business_id", business.id).eq("id", body.id).eq("status", previousBeeperStatus(body.status))
    .gte("created_at", new Date(Date.now() - 86400000).toISOString()).select("id,number,status").maybeSingle();
  return Response.json(error ? { error: "Modification impossible" } : data ? { order: data } : { error: "Commande absente ou déjà modifiée" }, { status: error ? 503 : data ? 200 : 409 });
} });
