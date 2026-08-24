import { z } from "zod";
import { merchantRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Clé publique VAPID pour l'abonnement push côté navigateur. */
export const GET = merchantRoute({
  handler: async () => {
    return Response.json({ key: process.env.VAPID_PUBLIC_KEY ?? null });
  },
});

const Body = z.object({
  endpoint: z.unknown().optional(),
  keys: z.unknown().optional(),
  remove: z.unknown().optional(),
});

/** Enregistre (ou supprime) l'abonnement push de cet appareil. */
export const POST = merchantRoute({
  schema: Body,
  handler: async ({ body: rawBody, business }) => {
    const body = rawBody as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
      remove?: boolean;
    };
    const endpoint = String(body.endpoint ?? "").slice(0, 1000);
    if (!endpoint.startsWith("https://")) {
      return Response.json({ error: "bad_subscription" }, { status: 400 });
    }

    const db = getAdminClient();

    if (body.remove) {
      try {
        await db
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", endpoint)
          .eq("business_id", business.id);
      } catch {
        /* table absente */
      }
      return Response.json({ ok: true });
    }

    const p256dh = String(body.keys?.p256dh ?? "");
    const auth = String(body.keys?.auth ?? "");
    if (!p256dh || !auth) {
      return Response.json({ error: "bad_subscription" }, { status: 400 });
    }

    try {
      const { error } = await db.from("push_subscriptions").upsert(
        {
          business_id: business.id,
          endpoint,
          p256dh,
          auth,
        },
        { onConflict: "endpoint" }
      );
      if (error) {
        return Response.json(
          { error: "save_failed", detail: error.message },
          { status: 500 }
        );
      }
    } catch (e: any) {
      return Response.json(
        { error: "save_failed", detail: e?.message ?? "table absente (migration 0023)" },
        { status: 500 }
      );
    }

    return Response.json({ ok: true });
  },
});
