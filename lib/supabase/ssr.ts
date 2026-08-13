import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client Supabase côté serveur lié à la session du commerçant (cookies).
 * Sert à identifier l'utilisateur connecté. Les opérations sur les données
 * passent, elles, par le client "admin" (service role) avec filtres explicites.
 */
export function createSSRClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Appelé depuis un Server Component : ignoré (le middleware rafraîchit).
          }
        },
      },
    }
  );
}
