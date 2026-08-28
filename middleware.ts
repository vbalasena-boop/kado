import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rafraîchit la session Supabase à chaque requête sur les zones protégées.
 * Sans cela, les cookies d'auth peuvent expirer côté serveur.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response; // non configuré : on laisse passer

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Rafraîchissement de session « best-effort », borné dans le temps.
  //
  // Sur l'Edge Vercel, le middleware a un budget d'exécution très court. Si
  // Supabase Auth est lent ou injoignable (projet gratuit en pause, incident,
  // pic de latence), `getUser()` peut rester bloqué jusqu'au timeout de la
  // plateforme → toutes les pages `/dashboard` renvoient alors un 504
  // MIDDLEWARE_INVOCATION_TIMEOUT et l'app paraît totalement hors-ligne.
  //
  // On borne donc l'appel : au-delà de 2,5 s on abandonne le rafraîchissement
  // et on laisse passer la requête. La vérification d'auth réelle est refaite
  // côté page (`getMyBusiness()` → redirection vers /login), donc renoncer ici
  // ne crée aucune faille : au pire le cookie n'est pas rafraîchi sur cette
  // requête. On dégrade gracieusement au lieu de tomber en panne.
  try {
    await withTimeout(supabase.auth.getUser(), 2500);
  } catch {
    // timeout ou erreur réseau : on n'empêche pas la navigation
  }
  return response;
}

/** Rejette après `ms` millisecondes si la promesse n'a pas résolu avant. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("supabase-auth-timeout")), ms)
    ),
  ]);
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth/:path*"],
};
