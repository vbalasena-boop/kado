import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  cleanHost,
  isKadoHost,
  rewritePathForOrderHost,
} from "@/lib/order-domain";

/**
 * Deux rôles :
 *  1. Domaine commerçant (ex. commander.qustos.fr) : l'hôte n'est pas à Kado
 *     → on retrouve le commerce (businesses.order_domain) et on RÉÉCRIT l'URL
 *     vers /<slug>/commander ou /<slug>/suivi/<code>. Le client reste sur le
 *     domaine du commerçant.
 *  2. Zones protégées (/dashboard, /auth) : rafraîchit la session Supabase à
 *     chaque requête. Sans cela, les cookies d'auth peuvent expirer côté
 *     serveur.
 */
export async function middleware(request: NextRequest) {
  const host = cleanHost(
    request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  );
  if (host && !isKadoHost(host)) {
    return orderDomainRewrite(request, host);
  }
  const path = request.nextUrl.pathname;
  if (path.startsWith("/dashboard") || path.startsWith("/auth")) {
    return refreshSession(request);
  }
  return NextResponse.next();
}

/* ------------------------------------------------------------------------ */
/* 1. Domaine commerçant                                                     */
/* ------------------------------------------------------------------------ */

/** Cache hôte → slug par isolat Edge (évite une lecture DB à chaque hit). */
const hostCache = new Map<string, { slug: string | null; until: number }>();
const HOST_TTL_MS = 5 * 60 * 1000;

async function orderDomainRewrite(request: NextRequest, host: string) {
  const slug = await slugForHost(host);
  if (!slug) return NextResponse.next(); // hôte inconnu : routage normal (404)
  const target = rewritePathForOrderHost(request.nextUrl.pathname, slug);
  if (!target) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = target;
  return NextResponse.rewrite(url);
}

/**
 * Retrouve le slug du commerce dont `order_domain` = hôte. Lecture PostgREST
 * directe (légère sur l'Edge), clé service (RLS ferme `businesses` au public),
 * bornée à 2 s, résultat mis en cache 5 min (y compris l'absence).
 */
async function slugForHost(host: string): Promise<string | null> {
  const now = Date.now();
  const hit = hostCache.get(host);
  if (hit && hit.until > now) return hit.slug;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  let slug: string | null = null;
  try {
    const q = new URL(`${url.replace(/\/$/, "")}/rest/v1/businesses`);
    q.searchParams.set("select", "slug");
    q.searchParams.set("order_domain", `eq.${host}`);
    q.searchParams.set("limit", "1");
    const res = await withTimeout(
      fetch(q, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
      }),
      2000
    );
    if (res.ok) {
      const rows = (await res.json()) as { slug?: string }[];
      slug = rows[0]?.slug ?? null;
    }
  } catch {
    // Timeout / réseau / colonne absente (migration 0083 non passée) :
    // on ne bloque pas, l'hôte est traité comme inconnu pour cette requête.
    return null;
  }
  hostCache.set(host, { slug, until: now + HOST_TTL_MS });
  return slug;
}

/* ------------------------------------------------------------------------ */
/* 2. Session Supabase sur les zones protégées                               */
/* ------------------------------------------------------------------------ */

async function refreshSession(request: NextRequest) {
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
  // Toutes les pages (pour reconnaître un domaine commerçant), sauf l'API,
  // les assets Next et les fichiers statiques (favicon, sw.js, images…).
  matcher: ["/((?!api/|_next/|.*\\..*).*)"],
};
