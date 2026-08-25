/**
 * Prospection Kado — sourcing via l'API Google Places (v1, "Text Search").
 *
 * Story A2. Objectif : à partir d'une ville et de segments, renvoyer une liste
 * normalisée de commerces avec leurs signaux publics (note et nombre d'avis
 * Google, site web…). La déduplication et l'écriture en base sont faites en A3 ;
 * l'extraction email/Instagram depuis le site est faite en A4.
 *
 * Coût maîtrisé : un seul appel "searchText" par mot-clé (la réponse contient
 * déjà note + nombre d'avis via le field mask), et arrêt dès que `limit` est
 * atteint. La clé API est lue côté serveur uniquement (jamais exposée au client).
 *
 * Mode démo : sans `GOOGLE_PLACES_API_KEY`, des données factices déterministes
 * sont renvoyées (`mock: true`) pour développer/tester sans clé ni coût.
 */
import { reportError } from "@/lib/report";
import type { ProspectSegment } from "@/lib/prospection/types";

const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.rating",
  "places.userRatingCount",
  "places.websiteUri",
  "places.primaryType",
  // Jeton de page suivante (pagination) — au niveau racine de la réponse.
  "nextPageToken",
].join(",");

/**
 * Nombre max de pages demandées par mot-clé (pagination Places).
 * L'API renvoie jusqu'à 20 résultats/page ; ~3 pages max côté Google (≈60).
 * Défaut : 3 (≈3× plus de prospects par ville sans exploser le quota).
 */
const MAX_PAGES = Math.min(
  Math.max(Number(process.env.PROSPECT_SOURCE_PAGES || 3), 1),
  3
);

/** Mots-clés de recherche Google par segment de prospection. */
const SEGMENT_KEYWORDS: Record<ProspectSegment, string[]> = {
  resto: ["restaurant", "bar", "café"],
  beaute: ["salon de coiffure", "institut de beauté", "barbier", "onglerie"],
  boutique: ["boutique", "magasin de vêtements", "fleuriste"],
  sport: ["salle de sport", "studio de yoga"],
  autre: ["commerce"],
};

export function segmentKeywords(segment: ProspectSegment): string[] {
  return SEGMENT_KEYWORDS[segment] ?? SEGMENT_KEYWORDS.autre;
}

/** Prospect sourcé, normalisé (sous-ensemble des colonnes de la table). */
export interface SourcedProspect {
  place_id: string;
  name: string;
  category: ProspectSegment;
  city: string;
  address: string | null;
  google_rating: number | null;
  google_reviews_count: number | null;
  website: string | null;
  primary_type: string | null;
}

/** Forme brute d'un lieu renvoyé par l'API Places v1. */
interface RawPlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  primaryType?: string;
}

/** Convertit un lieu brut Places en prospect normalisé (fonction pure). */
export function placeToProspect(
  place: RawPlace,
  segment: ProspectSegment,
  city: string
): SourcedProspect | null {
  if (!place.id || !place.displayName?.text) return null;
  return {
    place_id: place.id,
    name: place.displayName.text,
    category: segment,
    city,
    address: place.formattedAddress ?? null,
    google_rating: typeof place.rating === "number" ? place.rating : null,
    google_reviews_count:
      typeof place.userRatingCount === "number" ? place.userRatingCount : null,
    website: place.websiteUri ?? null,
    primary_type: place.primaryType ?? null,
  };
}

export interface SearchOptions {
  city: string;
  segments: ProspectSegment[];
  /** Nombre maximum de prospects uniques renvoyés (garde-quota). */
  limit?: number;
  /** Résultats max demandés à l'API par mot-clé (1–20). */
  perKeyword?: number;
}

export interface SearchResult {
  prospects: SourcedProspect[];
  /** true si les données proviennent du mode démo (pas de clé API). */
  mock: boolean;
}

/**
 * Source des prospects pour une ville + des segments.
 * Lève en cas d'échec dur de l'API (à capturer par l'appelant, story A3).
 */
export async function searchProspects(
  opts: SearchOptions
): Promise<SearchResult> {
  const { city, segments } = opts;
  const limit = opts.limit ?? 60;
  const perKeyword = Math.min(Math.max(opts.perKeyword ?? 20, 1), 20);
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    return { prospects: mockProspects(city, segments, limit), mock: true };
  }

  const seen = new Set<string>();
  const out: SourcedProspect[] = [];

  for (const segment of segments) {
    for (const keyword of segmentKeywords(segment)) {
      if (out.length >= limit) return { prospects: out, mock: false };

      // Pagination : on suit `nextPageToken` jusqu'à MAX_PAGES pour récupérer
      // ~3× plus de commerces par mot-clé, sans dépasser le plafond `limit`.
      let pageToken: string | undefined;
      for (let page = 0; page < MAX_PAGES; page++) {
        const { places, nextPageToken } = await fetchTextSearch(
          `${keyword} à ${city}`,
          perKeyword,
          apiKey,
          pageToken
        );
        for (const raw of places) {
          const p = placeToProspect(raw, segment, city);
          if (!p || seen.has(p.place_id)) continue;
          seen.add(p.place_id);
          out.push(p);
          if (out.length >= limit) break;
        }
        if (out.length >= limit || !nextPageToken) break;
        pageToken = nextPageToken;
      }
    }
  }

  return { prospects: out, mock: false };
}

interface TextSearchPage {
  places: RawPlace[];
  nextPageToken?: string;
}

async function fetchTextSearch(
  textQuery: string,
  maxResultCount: number,
  apiKey: string,
  pageToken?: string
): Promise<TextSearchPage> {
  try {
    const res = await fetch(PLACES_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery,
        languageCode: "fr",
        regionCode: "FR",
        maxResultCount,
        // Sur une page suivante, les autres paramètres doivent rester identiques.
        ...(pageToken ? { pageToken } : {}),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Places API ${res.status}: ${detail.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      places?: RawPlace[];
      nextPageToken?: string;
    };
    return { places: data.places ?? [], nextPageToken: data.nextPageToken };
  } catch (err) {
    reportError(err, { where: "prospection.searchProspects", textQuery });
    throw err;
  }
}

/**
 * Génère des prospects factices déterministes (mode démo, sans clé API).
 * Les notes/nombres d'avis varient pour tester le scoring en aval.
 */
export function mockProspects(
  city: string,
  segments: ProspectSegment[],
  limit: number
): SourcedProspect[] {
  const samples: Record<ProspectSegment, string[]> = {
    resto: ["Le Petit Bistrot", "Café des Amis", "Chez Marco", "La Table"],
    beaute: ["Studio Coiffure", "Institut Éclat", "Barber Shop", "Nails Bar"],
    boutique: ["Concept Store", "La Boutique", "Fleurs & Co", "Mode Élégance"],
    sport: ["Fit Studio", "Yoga Zen", "Muscu Club", "CrossBox"],
    autre: ["Commerce Local", "Le Comptoir", "La Maison", "L'Atelier"],
  };
  const out: SourcedProspect[] = [];
  let i = 0;
  for (const segment of segments) {
    for (const base of samples[segment] ?? samples.autre) {
      if (out.length >= limit) return out;
      const n = i + 1;
      out.push({
        place_id: `mock_${segment}_${n}`,
        name: `${base} ${city}`,
        category: segment,
        city,
        address: `${n} rue du Commerce, ${city}`,
        // Variation déterministe : certains ont peu d'avis (bonnes cibles).
        google_rating: 3.6 + ((i * 3) % 14) / 10, // 3.6 → 4.9
        google_reviews_count: (i * 17) % 220, // 0 → ~200
        website: i % 3 === 0 ? null : `https://exemple-${segment}-${n}.fr`,
        primary_type: segment,
      });
      i++;
    }
  }
  return out;
}
