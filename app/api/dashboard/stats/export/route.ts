import { merchantRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { playsToCsv, type PlayCsvRow } from "@/lib/stats-csv";

export const dynamic = "force-dynamic";

const CHUNK = 1000;
const MAX_ROWS = 100_000;

/**
 * Export CSV « Journal d'activité » du commerçant connecté : un tour par ligne
 * (date, action, lot, résultat, code, récupération). Pagine toute la base par
 * tranches côté serveur (comme l'export des contacts). BOM UTF-8 pour Excel.
 */
export const GET = merchantRoute({
  handler: async ({ business }) => {
    const admin = getAdminClient();
    const cols = "created_at, play_type, prize_label, prize_code, is_losing, redeemed_at";
    const rows: PlayCsvRow[] = [];
    for (let offset = 0; offset < MAX_ROWS; offset += CHUNK) {
      const { data, error } = await admin
        .from("plays")
        .select(cols)
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + CHUNK - 1);
      if (error) {
        return Response.json({ error: "export_failed" }, { status: 500 });
      }
      const batch = (data as PlayCsvRow[]) ?? [];
      rows.push(...batch);
      if (batch.length < CHUNK) break;
    }

    const body = `﻿${playsToCsv(rows)}`;
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="activite-kado.csv"',
        "Cache-Control": "no-store",
      },
    });
  },
});
