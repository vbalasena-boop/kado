import { z } from "zod";
import { publicRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Schéma permissif : la validation métier (e-mail, présence) reste ci-dessous.
const Body = z.object({
  slug: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
});

/** Enregistre un e-mail (opt-in) laissé par un joueur pour un établissement. */
export const POST = publicRoute({
  schema: Body,
  // Anti-abus : 10 soumissions/min max par IP
  rateLimit: { key: ({ ip }) => `lead:${ip}`, limit: 10, windowSeconds: 60 },
  handler: async ({ body }) => {
    const email = (body.email || "").trim();
    const phone = (body.phone || "").trim();
    if (!body.slug || (!email && !phone)) {
      return Response.json({ error: "missing" }, { status: 400 });
    }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return Response.json({ error: "bad_email" }, { status: 400 });
    }

    const db = getAdminClient();
    const { data: biz } = await db
      .from("businesses")
      .select("id")
      .eq("slug", body.slug)
      .maybeSingle();
    if (!biz) return Response.json({ error: "not_found" }, { status: 404 });

    const { error } = await db
      .from("leads")
      .insert({ business_id: biz.id, email: email || null, phone: phone || null });
    if (error) return Response.json({ error: "save_failed" }, { status: 500 });

    return Response.json({ ok: true });
  },
});
