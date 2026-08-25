import { NextRequest } from "next/server";
import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { isMissingColumnError } from "@/lib/db-errors";
import { reportError } from "@/lib/report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Récupère l'id du compte Stripe connecté du commerce (lecture tolérante). */
async function getAccountId(db: any, businessId: string): Promise<string | null> {
  try {
    const { data } = await db
      .from("businesses")
      .select("stripe_account_id")
      .eq("id", businessId)
      .maybeSingle();
    return (data as any)?.stripe_account_id ?? null;
  } catch {
    return null;
  }
}

/**
 * POST : démarre (ou reprend) la connexion Stripe du commerçant — compte
 * Express + lien d'onboarding. Renvoie { url } pour rediriger le commerçant.
 * L'argent des commandes ira DIRECTEMENT sur ce compte.
 */
export async function POST(req: NextRequest) {
  const { business } = await getMyBusiness();
  if (!business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }
  const origin = new URL(req.url).origin;
  const db = getAdminClient();
  const stripe = getStripe();

  try {
    // Crée un compte Express neuf et l'enregistre (readiness remise à zéro).
    // Renvoie l'id, ou null si les colonnes paiement manquent (migration 0040).
    async function createAccount(): Promise<string | null> {
      const account = await stripe.accounts.create({
        type: "express",
        country: "FR",
        email: undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: { business_id: business!.id },
      });
      const { error } = await db
        .from("businesses")
        .update({ stripe_account_id: account.id, stripe_account_ready: false })
        .eq("id", business!.id);
      return error ? null : account.id;
    }

    async function onboardingLink(account: string) {
      return stripe.accountLinks.create({
        account,
        refresh_url: `${origin}/dashboard/orders?connect=refresh`,
        return_url: `${origin}/dashboard/orders?connect=done`,
        type: "account_onboarding",
      });
    }

    let acct = await getAccountId(db, business.id);
    if (!acct) {
      acct = await createAccount();
      if (!acct) return Response.json({ error: "not_ready" }, { status: 409 });
    }

    let link;
    try {
      link = await onboardingLink(acct);
    } catch (e: any) {
      // Compte stocké introuvable (supprimé, ou créé dans l'autre mode
      // test/live) → on en recrée un propre et on réessaie une seule fois.
      if (e?.code === "resource_missing" || e?.statusCode === 404) {
        const fresh = await createAccount();
        if (!fresh)
          return Response.json({ error: "not_ready" }, { status: 409 });
        link = await onboardingLink(fresh);
      } else {
        throw e;
      }
    }
    return Response.json({ url: link.url });
  } catch (e: any) {
    return Response.json(
      { error: "stripe_error", detail: e?.message ?? "stripe" },
      { status: 500 }
    );
  }
}

/**
 * GET : vérifie l'état du compte connecté (paiements activés ?) et met à jour
 * businesses.stripe_account_ready. Appelé au retour de l'onboarding.
 */
export async function GET(req: NextRequest) {
  const { business } = await getMyBusiness();
  if (!business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }
  const db = getAdminClient();
  const stripe = getStripe();
  try {
    const acct = await getAccountId(db, business.id);
    if (!acct) return Response.json({ connected: false, ready: false });
    let account;
    try {
      account = await stripe.accounts.retrieve(acct);
    } catch (e: any) {
      // Compte introuvable dans ce mode (bascule test↔live) → on l'oublie
      // pour qu'un prochain « Connecter Stripe » en crée un propre.
      if (e?.code === "resource_missing" || e?.statusCode === 404) {
        // Écriture secondaire de recovery : on oublie le compte introuvable.
        // Colonnes absentes → ignoré ; vraie erreur → reportError, mais la
        // recovery poursuit ({ connected:false }), aucun 500 introduit.
        try {
          const { error } = await db
            .from("businesses")
            .update({ stripe_account_id: null, stripe_account_ready: false })
            .eq("id", business.id);
          if (error && !isMissingColumnError(error)) {
            reportError(error, { where: "billing/connect.clear" });
          }
        } catch (clearErr) {
          reportError(clearErr, { where: "billing/connect.clear" });
        }
        return Response.json({ connected: false, ready: false });
      }
      throw e;
    }
    const ready = !!account.charges_enabled;
    await db
      .from("businesses")
      .update({ stripe_account_ready: ready })
      .eq("id", business.id);
    return Response.json({ connected: true, ready });
  } catch (e: any) {
    return Response.json(
      { error: "stripe_error", detail: e?.message ?? "stripe" },
      { status: 500 }
    );
  }
}
