import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Keep-alive Supabase (cron Vercel quotidien).
 *
 * Sur le plan gratuit, un projet Supabase inactif pendant ~7 jours est mis en
 * PAUSE : l'auth et la base ne répondent plus, ce qui provoque l'échec de
 * connexion et les 504 côté app. Une simple requête par jour suffit à marquer
 * le projet comme « actif » et à empêcher la mise en pause.
 *
 * L'endpoint fait donc une lecture triviale et bornée. Il est protégé par le
 * même secret que les autres crons (fail-closed).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    // Lecture minimale : une seule ligne, aucune donnée sensible renvoyée.
    // Le seul but est de générer une activité base pour éviter la pause.
    const { error } = await getAdminClient()
      .from("businesses")
      .select("id")
      .limit(1);
    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 502 });
    }
    return Response.json({ ok: true, at: new Date().toISOString() });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 502 }
    );
  }
}
