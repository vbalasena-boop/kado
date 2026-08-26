import { merchantRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { leadsToCsv, type LeadCsvRow } from "@/lib/leads-csv";

export const dynamic = "force-dynamic";

/** Lecture par tranches (contourne la limite implicite de lignes par requête). */
const CHUNK = 1000;
/** Garde-fou mémoire : plafond dur d'export. */
const MAX_ROWS = 100_000;

/**
 * Export CSV COMPLET des contacts du commerçant connecté. Contrairement à
 * l'ancien export côté client (limité aux lignes déjà chargées), on pagine ici
 * toute la base par tranches, côté serveur. Format identique (BOM + ISO).
 */
export const GET = merchantRoute({
  handler: async ({ business }) => {
    const admin = getAdminClient();
    const rows: LeadCsvRow[] = [];
    for (let offset = 0; offset < MAX_ROWS; offset += CHUNK) {
      const { data, error } = await admin
        .from("leads")
        .select("email, phone, created_at")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + CHUNK - 1);
      if (error) {
        return Response.json({ error: "export_failed" }, { status: 500 });
      }
      const batch = (data as LeadCsvRow[]) ?? [];
      rows.push(...batch);
      if (batch.length < CHUNK) break; // dernière tranche
    }

    // BOM UTF-8 pour qu'Excel lise correctement les accents.
    const body = `﻿${leadsToCsv(rows)}`;
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="clients-kado.csv"',
        "Cache-Control": "no-store",
      },
    });
  },
});
