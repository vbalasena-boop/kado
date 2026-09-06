/**
 * Construction du CSV « Journal d'activité » (export commerçant, analytics).
 * Une ligne par tour joué. Pur/testable, réutilisé par la route d'export qui
 * pagine toute la base côté serveur. Le BOM UTF-8 est ajouté par l'appelant.
 */
import { labelIsLosing } from "@/lib/draw";

export type PlayCsvRow = {
  created_at: string;
  play_type: string;
  prize_label: string | null;
  prize_code: string | null;
  is_losing?: boolean | null;
  redeemed_at?: string | null;
};

const ACTION_LABEL: Record<string, string> = {
  instagram: "Instagram",
  loyalty: "Fidélité",
  optin: "Offres e-mail",
  review: "Avis (ancien)",
};

/** Libellé lisible de l'action déclenchante (repli : la valeur brute). */
export function playActionLabel(type: string): string {
  return ACTION_LABEL[type] ?? type;
}

/** Échappe un champ CSV (guillemets doublés, entouré de guillemets). */
function cell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Rendu CSV (sans BOM). En-tête : date, action, lot, resultat, code, recupere.
 * `resultat` = « gagné »/« perdu » (via `is_losing`, repli sur le libellé).
 * `recupere` = date ISO de récupération en caisse, ou vide.
 */
export function playsToCsv(rows: PlayCsvRow[]): string {
  const won = (r: PlayCsvRow) =>
    !(r.is_losing ?? labelIsLosing(r.prize_label ?? ""));
  const table: string[][] = [
    ["date", "action", "lot", "resultat", "code", "recupere"],
    ...rows.map((r) => [
      new Date(r.created_at).toISOString(),
      playActionLabel(r.play_type),
      r.prize_label ?? "",
      won(r) ? "gagné" : "perdu",
      r.prize_code ?? "",
      r.redeemed_at ? new Date(r.redeemed_at).toISOString() : "",
    ]),
  ];
  return table.map((r) => r.map(cell).join(",")).join("\n");
}
