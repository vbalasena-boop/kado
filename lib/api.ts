import { NextRequest } from "next/server";
import type { ZodType } from "zod";
import type { User } from "@supabase/supabase-js";
import {
  getMyBusiness,
  getSessionUser,
  hasAccess,
  hasModule,
  hasClickCollect,
  type Business,
} from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { getAdminUser } from "@/lib/admin-guard";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { reportError } from "@/lib/report";

/**
 * Wrapper de route unifié : centralise le garde d'authentification, le parsing
 * + validation zod du corps, le rate-limit optionnel et le format d'erreur.
 *
 * Objectif : supprimer le copier-coller (parse JSON, gardes, réponses d'erreur)
 * répété dans ~40 routes. Trois portes d'entrée typées selon le niveau requis :
 *   - `publicRoute`   : aucune authentification
 *   - `merchantRoute` : commerçant connecté (business garanti non-null)
 *   - `adminRoute`    : administrateur (email dans ADMIN_EMAILS)
 */

type Params = Record<string, string>;

/** Options communes à toutes les routes. */
type BaseOpts<B> = {
  /** Schéma zod du corps JSON. Si absent, `body` vaut `undefined`. */
  schema?: ZodType<B>;
  /** Rate-limit optionnel. `key` reçoit l'IP et les paramètres d'URL. */
  rateLimit?: {
    key: (ctx: { ip: string; params: Params }) => string;
    limit: number;
    windowSeconds: number;
  };
};

type PublicCtx<B> = { req: NextRequest; params: Params; body: B };
type MerchantCtx<B> = PublicCtx<B> & { business: Business; user: User };
type AdminCtx<B> = PublicCtx<B> & { user: User };

type Handler<Ctx> = (ctx: Ctx) => Response | Promise<Response>;
type NextHandler = (
  req: NextRequest,
  ctx?: { params?: Params }
) => Promise<Response>;

const json = (data: unknown, status = 200) => Response.json(data, { status });

/** Parse + valide le corps JSON. Renvoie `{ ok, body }` ou une Response d'erreur. */
async function parseBody<B>(
  req: NextRequest,
  schema?: ZodType<B>
): Promise<{ ok: true; body: B } | { ok: false; res: Response }> {
  if (!schema) return { ok: true, body: undefined as B };
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, res: json({ error: "bad_request" }, 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      res: json(
        { error: "invalid_body", detail: parsed.error.issues.map((i) => i.message) },
        400
      ),
    };
  }
  return { ok: true, body: parsed.data };
}

/** Applique le rate-limit si configuré. Renvoie une Response 429 ou null. */
async function checkRateLimit<B>(
  req: NextRequest,
  params: Params,
  rl?: BaseOpts<B>["rateLimit"]
): Promise<Response | null> {
  if (!rl) return null;
  const ok = await rateLimit(
    rl.key({ ip: clientIp(req), params }),
    rl.limit,
    rl.windowSeconds
  );
  return ok ? null : json({ error: "rate_limited" }, 429);
}

/** Enveloppe l'appel du handler pour capturer les exceptions → 500. */
async function guard(
  where: string,
  fn: () => Response | Promise<Response>
): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    reportError(e, { where });
    return json({ error: "server_error" }, 500);
  }
}

/** Route publique (aucune authentification). */
export function publicRoute<B = undefined>(
  opts: BaseOpts<B> & { handler: Handler<PublicCtx<B>> }
): NextHandler {
  return async (req, ctx) => {
    const params = ctx?.params ?? {};
    const rl = await checkRateLimit(req, params, opts.rateLimit);
    if (rl) return rl;
    const parsed = await parseBody(req, opts.schema);
    if (!parsed.ok) return parsed.res;
    return guard(req.nextUrl.pathname, () =>
      opts.handler({ req, params, body: parsed.body })
    );
  };
}

/** Options de gating (droits) propres aux routes commerçant. */
type MerchantGate = {
  /**
   * Refuse (403) si l'établissement n'a plus accès : suspendu par l'admin ou
   * abonnement/essai expiré (cf. `hasAccess`). À poser sur les routes qui
   * MODIFIENT des données métier — un commerce inactif ne doit pas écrire.
   */
  requireActive?: boolean;
  /**
   * Refuse (403) si l'établissement n'a pas le module jeu indiqué
   * (cf. `hasModule`). À N'UTILISER que sur une route servant un seul module :
   * l'éditeur de roue, p.ex., sert À LA FOIS « roue » et « fidélité », donc
   * NE PAS y poser de garde de module.
   */
  requireModule?: "roue" | "fidelite";
  /**
   * Refuse (403) si l'établissement n'a pas le Click & Collect (cf.
   * `hasClickCollect`). À poser sur les routes de CONFIG C&C (produits,
   * horaires, création de commande). Le drapeau `click_collect` est lu de façon
   * TOLÉRANTE (fail-open sur erreur de lecture) : l'UI reste le garde principal.
   */
  requireClickCollect?: boolean;
};

/** Route commerçant : exige un établissement rattaché au compte connecté. */
export function merchantRoute<B = undefined>(
  opts: BaseOpts<B> & MerchantGate & { handler: Handler<MerchantCtx<B>> }
): NextHandler {
  return async (req, ctx) => {
    const params = ctx?.params ?? {};
    const { user, business } = await getMyBusiness();
    if (!user || !business) {
      return json({ error: "not_authenticated" }, 401);
    }
    // Gating des droits AVANT tout traitement : un commerce inactif ou sans le
    // module requis est refusé sans exécuter le handler (fail-closed).
    if (opts.requireActive && !hasAccess(business)) {
      return json({ error: "forbidden", reason: "inactive" }, 403);
    }
    if (opts.requireModule && !hasModule(business, opts.requireModule)) {
      return json({ error: "forbidden", reason: "module" }, 403);
    }
    if (opts.requireClickCollect) {
      // Essai / plans Comptoir·Complet → accordé sans lecture. Sinon on lit le
      // drapeau addon `click_collect` de façon tolérante (fail-open sur erreur :
      // ne pas bloquer un légitime sur un hoquet DB — l'UI garde déjà l'accès).
      let ok = hasClickCollect(business);
      if (!ok) {
        try {
          const { data } = await getAdminClient()
            .from("businesses")
            .select("click_collect")
            .eq("id", business.id)
            .maybeSingle();
          ok = !!(data as { click_collect?: boolean | null } | null)?.click_collect;
        } catch {
          ok = true;
        }
      }
      if (!ok) return json({ error: "forbidden", reason: "click_collect" }, 403);
    }
    const rl = await checkRateLimit(req, params, opts.rateLimit);
    if (rl) return rl;
    const parsed = await parseBody(req, opts.schema);
    if (!parsed.ok) return parsed.res;
    return guard(req.nextUrl.pathname, () =>
      opts.handler({ req, params, body: parsed.body, business, user })
    );
  };
}

/** Route admin : exige un e-mail présent dans ADMIN_EMAILS. */
export function adminRoute<B = undefined>(
  opts: BaseOpts<B> & { handler: Handler<AdminCtx<B>> }
): NextHandler {
  return async (req, ctx) => {
    const params = ctx?.params ?? {};
    const user = await getAdminUser();
    if (!user) return json({ error: "forbidden" }, 403);
    const rl = await checkRateLimit(req, params, opts.rateLimit);
    if (rl) return rl;
    const parsed = await parseBody(req, opts.schema);
    if (!parsed.ok) return parsed.res;
    return guard(req.nextUrl.pathname, () =>
      opts.handler({ req, params, body: parsed.body, user })
    );
  };
}
