/**
 * Prospection Kado — logique de sourcing/déduplication (story A3).
 *
 * Fonctions pures (sans base de données) pour rester testables : la route
 * `POST /api/admin/prospection/source` les combine avec le client Supabase.
 */
import type { SourcedProspect } from "@/lib/prospection/places";

/** Ligne prête à insérer dans la table `prospects`. */
export interface NewProspectRow {
  place_id: string;
  name: string;
  category: string;
  city: string;
  address: string | null;
  google_rating: number | null;
  google_reviews_count: number | null;
  website: string | null;
  status: "new";
}

/** Convertit un prospect sourcé en ligne de base (statut initial "new"). */
export function toRow(s: SourcedProspect): NewProspectRow {
  return {
    place_id: s.place_id,
    name: s.name,
    category: s.category,
    city: s.city,
    address: s.address,
    google_rating: s.google_rating,
    google_reviews_count: s.google_reviews_count,
    website: s.website,
    status: "new",
  };
}

/**
 * Sépare les prospects sourcés en "nouveaux" et "doublons".
 * Déduplique à la fois contre les `place_id` déjà en base (`existingIds`)
 * et contre les doublons internes au lot courant.
 */
export function partitionNew(
  sourced: SourcedProspect[],
  existingIds: Set<string>
): { toInsert: SourcedProspect[]; duplicates: SourcedProspect[] } {
  const toInsert: SourcedProspect[] = [];
  const duplicates: SourcedProspect[] = [];
  const seen = new Set<string>(existingIds);
  for (const p of sourced) {
    if (seen.has(p.place_id)) {
      duplicates.push(p);
    } else {
      seen.add(p.place_id);
      toInsert.push(p);
    }
  }
  return { toInsert, duplicates };
}
