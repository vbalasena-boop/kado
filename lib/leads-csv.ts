/**
 * Construction du CSV « Clients collectés » (export commerçant).
 * Extrait tel quel de l'ancien export côté client (LeadsClient) pour garantir
 * un format IDENTIQUE, et le rendre pur/testable + réutilisable côté serveur
 * (l'export passe désormais par une route qui pagine toute la base, sans la
 * limite implicite de lignes d'une requête unique).
 */

/** Taille de page pour l'affichage « Clients collectés ». */
export const LEADS_PAGE_SIZE = 100;

export type LeadCsvRow = {
  email: string | null;
  phone: string | null;
  created_at: string;
};

/** Échappe un champ CSV (guillemets doublés, entouré de guillemets). */
function cell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Rendu CSV (sans BOM) : en-tête `email,telephone,date` puis une ligne par
 * contact, date en ISO 8601. Le BOM UTF-8 est ajouté par l'appelant.
 */
export function leadsToCsv(rows: LeadCsvRow[]): string {
  const table: string[][] = [
    ["email", "telephone", "date"],
    ...rows.map((l) => [
      l.email ?? "",
      l.phone ?? "",
      new Date(l.created_at).toISOString(),
    ]),
  ];
  return table.map((r) => r.map(cell).join(",")).join("\n");
}
