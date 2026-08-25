import { config } from './config';

export interface PlaceResult {
  placeId: string;
  name: string;
  rating: number | null;
  reviews: number;
}

interface TextSearchResponse {
  status: string;
  error_message?: string;
  results: Array<{
    place_id: string;
    name: string;
    rating?: number;
    user_ratings_total?: number;
  }>;
}

interface DetailsResponse {
  status: string;
  error_message?: string;
  result?: {
    website?: string;
    rating?: number;
    user_ratings_total?: number;
  };
}

const BASE = 'https://maps.googleapis.com/maps/api/place';

/**
 * Recherche des commerces via Google Places (Text Search).
 * Les résultats sont renvoyés dans l'ordre de pertinence de Google
 * (= la "position" perçue par un client qui cherche).
 */
export async function searchBusinesses(query: string): Promise<PlaceResult[]> {
  const url =
    `${BASE}/textsearch/json?query=${encodeURIComponent(query)}` +
    `&language=fr&region=fr&key=${config.placesApiKey}`;
  const res = await fetch(url);
  const data = (await res.json()) as TextSearchResponse;

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(
      `Google Places (search) : ${data.status}${
        data.error_message ? ' — ' + data.error_message : ''
      }`,
    );
  }

  return (data.results ?? []).map((r) => ({
    placeId: r.place_id,
    name: r.name,
    rating: r.rating ?? null,
    reviews: r.user_ratings_total ?? 0,
  }));
}

/** Récupère le site web d'un commerce (nécessaire pour trouver son e-mail). */
export async function getWebsite(placeId: string): Promise<string | null> {
  const url =
    `${BASE}/details/json?place_id=${encodeURIComponent(placeId)}` +
    `&fields=website&language=fr&key=${config.placesApiKey}`;
  const res = await fetch(url);
  const data = (await res.json()) as DetailsResponse;

  if (data.status !== 'OK') {
    // NOT_FOUND ou quota : on n'échoue pas tout le seed pour un commerce.
    return null;
  }
  return data.result?.website ?? null;
}
