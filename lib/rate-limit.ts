import { getAdminClient } from "@/lib/supabase/admin";

/**
 * Limite de débit atomique via Postgres (fonction rate_limit_hit).
 * Renvoie true si la requête est autorisée, false si le quota est dépassé.
 * En cas d'erreur (ou fonction absente), on « fail open » : on autorise,
 * pour ne jamais casser le service à cause du limiteur.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    const db = getAdminClient();
    const { data, error } = await db.rpc("rate_limit_hit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) return true; // fail open
    return data !== false;
  } catch {
    return true; // fail open
  }
}

/** Adresse IP de l'appelant (derrière le proxy Vercel). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
