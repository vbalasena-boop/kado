import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import type { ProspectStatus } from "@/lib/prospection/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const STATUS_LABEL: Record<ProspectStatus, string> = {
  new: "Nouveau",
  queued: "En file",
  emailed: "Email envoyé",
  dm_pending: "DM à envoyer",
  dm_sent: "DM envoyé",
  replied: "A répondu",
  interested: "Intéressé",
  client: "Client",
  excluded: "Exclu",
};

type Row = {
  name: string;
  city: string | null;
  category: string | null;
  google_rating: number | null;
  google_reviews_count: number | null;
  score: number | null;
  email: string | null;
  instagram_handle: string | null;
  status: ProspectStatus;
  created_at: string;
};

/** Échappe un champ CSV (guillemets doublés, encadré si nécessaire). */
function csv(value: string | number | null): string {
  const s = value == null ? "" : String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Export CSV de tous les prospects (pour travailler hors admin / partager).
 * Séparateur « ; » (compatible Excel FR) + BOM UTF-8.
 */
export const GET = adminRoute({
  handler: async () => {
    const db = getAdminClient();
    const { data, error } = await db
      .from("prospects")
      .select(
        "name, city, category, google_rating, google_reviews_count, score, email, instagram_handle, status, created_at"
      )
      .order("score", { ascending: false, nullsFirst: false })
      .limit(5000);
    if (error) return Response.json({ error: "db_error" }, { status: 500 });

    const rows = (data ?? []) as Row[];
    const header = [
      "Nom",
      "Ville",
      "Segment",
      "Note Google",
      "Avis Google",
      "Score",
      "Email",
      "Instagram",
      "Statut",
      "Créé le",
    ];
    const lines = [header.join(";")];
    for (const r of rows) {
      lines.push(
        [
          csv(r.name),
          csv(r.city),
          csv(r.category),
          csv(r.google_rating),
          csv(r.google_reviews_count),
          csv(r.score),
          csv(r.email),
          csv(r.instagram_handle ? `@${r.instagram_handle}` : ""),
          csv(STATUS_LABEL[r.status] ?? r.status),
          csv(r.created_at?.slice(0, 10) ?? ""),
        ].join(";")
      );
    }

    const body = "﻿" + lines.join("\r\n"); // BOM pour Excel
    const date = new Date().toISOString().slice(0, 10);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="prospects-kado-${date}.csv"`,
      },
    });
  },
});
