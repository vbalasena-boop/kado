import { merchantRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { isMissingColumnError } from "@/lib/db-errors";
import {
  bucketDailyFunnel,
  funnelDailyToCsv,
  type FunnelEvent,
} from "@/lib/funnel-csv";

export const dynamic = "force-dynamic";

const CHUNK = 1000;
const MAX_ROWS = 50_000;
const WINDOW_DAYS = 60;

/** Pagine une table (colonnes `cols`) depuis `since`. Tolérant : table absente
 *  (migration en retard) → tableau vide plutôt qu'une erreur. */
async function fetchSince(
  admin: ReturnType<typeof getAdminClient>,
  table: string,
  cols: string,
  businessId: string,
  since: string
): Promise<any[] | null> {
  const rows: any[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += CHUNK) {
    const { data, error } = await admin
      .from(table)
      .select(cols)
      .eq("business_id", businessId)
      .gte("created_at", since)
      // `id` en second critère : ordre total stable → la pagination par `range`
      // ne saute ni ne double une ligne quand plusieurs partagent le même
      // `created_at` à cheval sur une page.
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + CHUNK - 1);
    if (error) {
      // Table pas encore déployée → on l'ignore (parcours partiel, jamais 500).
      if (isMissingColumnError(error)) return [];
      return null;
    }
    const batch = (data as any[]) ?? [];
    rows.push(...batch);
    if (batch.length < CHUNK) break;
  }
  return rows;
}

/**
 * Export CSV « Parcours client » du commerçant connecté : une ligne par jour
 * (scans, tours, dont Instagram, clics avis) sur les 60 derniers jours. BOM
 * UTF-8 pour Excel.
 */
export const GET = merchantRoute({
  handler: async ({ business }) => {
    const admin = getAdminClient();
    const since = new Date(Date.now() - WINDOW_DAYS * 864e5).toISOString();

    const [scans, plays, reviews] = await Promise.all([
      fetchSince(admin, "scans", "created_at", business.id, since),
      fetchSince(admin, "plays", "created_at, play_type", business.id, since),
      fetchSince(admin, "review_clicks", "created_at", business.id, since),
    ]);
    // null = vraie panne (pas « table absente ») → on échoue franchement.
    if (scans === null || plays === null || reviews === null) {
      return Response.json({ error: "export_failed" }, { status: 500 });
    }

    const events: FunnelEvent[] = [];
    for (const r of scans) events.push({ kind: "scan", at: r.created_at });
    for (const r of plays) {
      events.push({ kind: "play", at: r.created_at });
      if (r.play_type === "instagram") events.push({ kind: "insta", at: r.created_at });
    }
    for (const r of reviews) events.push({ kind: "review", at: r.created_at });

    const body = `﻿${funnelDailyToCsv(bucketDailyFunnel(events))}`;
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="parcours-kado.csv"',
        "Cache-Control": "no-store",
      },
    });
  },
});
