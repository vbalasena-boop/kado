import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase "service role" — À N'UTILISER QUE CÔTÉ SERVEUR.
 * La clé service_role contourne les règles RLS : elle ne doit jamais être
 * exposée au navigateur. On l'utilise dans les Server Components et les
 * Route Handlers (API) uniquement, avec des filtres explicites par tenant.
 */
let cached: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase non configuré : renseigne SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
