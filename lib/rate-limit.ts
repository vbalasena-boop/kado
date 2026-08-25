import { getAdminClient } from "@/lib/supabase/admin";
import { reportError } from "@/lib/report";

/**
 * Limite de débit. Chemin nominal : fonction Postgres atomique `rate_limit_hit`
 * (partagée entre toutes les instances). Si elle échoue ou est absente, on NE
 * « fail-open » PLUS : on retombe sur un compteur en mémoire (par instance) qui
 * continue d'appliquer une limite, et on alerte Sentry une fois. C'est
 * volontairement conservateur — mieux vaut limiter par instance que d'ouvrir en
 * grand les routes publiques (email-bombing, énumération de codes).
 */

type Bucket = { count: number; resetAt: number };
const memory = new Map<string, Bucket>();
let rpcFailureReported = false;

/** Compteur à fenêtre fixe, en mémoire du process (repli best-effort). */
function memoryLimit(key: string, limit: number, windowSeconds: number): boolean {
  const now = Date.now();
  const rec = memory.get(key);
  if (!rec || rec.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    // Purge opportuniste des entrées expirées pour borner la mémoire.
    if (memory.size > 5000) {
      for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
    }
    return true;
  }
  rec.count += 1;
  return rec.count <= limit;
}

function reportRpcFailureOnce(e: unknown) {
  if (rpcFailureReported) return;
  rpcFailureReported = true;
  reportError(e ?? new Error("rate_limit_hit indisponible"), {
    where: "lib/rate-limit",
    note: "RPC rate_limit_hit indisponible — repli sur le compteur mémoire.",
  });
}

/**
 * Renvoie true si la requête est autorisée, false si le quota est dépassé.
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
    if (error) {
      reportRpcFailureOnce(error);
      return memoryLimit(key, limit, windowSeconds);
    }
    return data !== false;
  } catch (e) {
    reportRpcFailureOnce(e);
    return memoryLimit(key, limit, windowSeconds);
  }
}

/** Adresse IP de l'appelant (derrière le proxy Vercel). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
