import { cookies } from "next/headers";
import { publicRoute } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/defaults";
import { prizesForCategory } from "@/lib/categories";
import { insertPrizes } from "@/lib/prizes";
import { isMissingColumnError } from "@/lib/db-errors";
import { reportError } from "@/lib/report";

export const dynamic = "force-dynamic";

/**
 * Inscription self-service : le commerçant connecté crée son propre
 * établissement (essai gratuit de 14 jours). Roue + cadeaux par défaut.
 *
 * Auth et vérification d'unicité ont lieu AVANT le parsing JSON : on conserve
 * donc un parsing manuel dans le handler (pas de schéma dans le wrapper) pour
 * préserver l'ordre exact des réponses d'erreur.
 */
export const POST = publicRoute({
  handler: async ({ req }) => {
    const user = await getSessionUser();
    if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

    const db = getAdminClient();

    // Déjà un établissement rattaché à ce compte ? on ne recrée pas.
    const { data: existing } = await db
      .from("businesses")
      .select("id, slug")
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (existing) return Response.json({ ok: true, slug: existing.slug });

    let body: {
      name?: string;
      category?: string;
      plan?: string;
      phone?: string;
      parrain?: string;
    };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "bad_request" }, { status: 400 });
    }
    const name = (body.name || "").trim();
    if (!name) return Response.json({ error: "name_required" }, { status: 400 });
    const plan = ["roue", "fidelite", "complet", "comptoir"].includes(body.plan ?? "")
      ? body.plan!
      : "roue";
    // Téléphone : on ne garde que chiffres, + et espaces
    const phone =
      (body.phone || "").replace(/[^\d+ .-]/g, "").trim().slice(0, 20) || null;

    // slug unique
    const base = slugify(name);
    let slug = base;
    for (let i = 2; i < 100; i++) {
      const { data: exists } = await db
        .from("businesses")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!exists) break;
      slug = `${base}-${i}`;
    }

    // établissement (essai gratuit de 14 jours)
    const trialEnds = new Date(Date.now() + 14 * 864e5).toISOString();
    const { data: biz, error: bizErr } = await db
      .from("businesses")
      .insert({
        slug,
        name,
        plan,
        status: "active",
        subscription_status: "trial",
        subscription_ends_at: trialEnds,
        owner_user_id: user.id,
      })
      .select("id")
      .single();
    if (bizErr || !biz) {
      return Response.json({ error: "create_failed" }, { status: 500 });
    }

    // Téléphone : mise à jour séparée et tolérante (colonne facultative).
    // Écriture secondaire → on n'interrompt pas l'inscription, mais on ne gobe
    // plus une vraie panne en silence.
    if (phone) {
      const { error } = await db
        .from("businesses")
        .update({ phone })
        .eq("id", biz.id);
      if (error && !isMissingColumnError(error)) {
        reportError(error, { where: "onboarding.phone" });
      }
    }

    // Parrainage commerçant : on relie le filleul à son parrain (tolérant).
    // La source du parrain est le corps de la requête OU le cookie kado-parrain
    // posé par RefCapture (lien /tarifs?parrain=<slug> depuis la roue).
    const parrainSlug = (body.parrain || cookies().get("kado-parrain")?.value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "");
    if (parrainSlug && parrainSlug !== slug) {
      const { data: sponsor } = await db
        .from("businesses")
        .select("id, phone")
        .eq("slug", parrainSlug)
        .maybeSingle();
      if (sponsor && sponsor.id !== biz.id) {
        // Anti-fraude : on refuse l'attribution si parrain et filleul partagent
        // le même téléphone. Le contrôle carte/client Stripe se fait plus tard,
        // au versement (webhook). (Un même compte ne peut pas être son propre
        // parrain : un utilisateur ne possède qu'un seul commerce.)
        const samePhone = !!phone && !!sponsor.phone && phone === sponsor.phone;
        if (samePhone) {
          // Écriture secondaire : ne doit jamais interrompre l'inscription.
          // Table absente (migration 0042) → ignorée ; vraie erreur → reportError.
          try {
            const { error } = await db.from("referral_blocks").insert({
              filleul_business_id: biz.id,
              parrain_slug: parrainSlug,
              reason: "same_phone",
            });
            if (error && !isMissingColumnError(error)) {
              reportError(error, { where: "onboarding.referral_blocks" });
            }
          } catch (e) {
            reportError(e, { where: "onboarding.referral_blocks" });
          }
        } else {
          const { error } = await db
            .from("businesses")
            .update({ referred_by: sponsor.id })
            .eq("id", biz.id);
          if (error && !isMissingColumnError(error)) {
            reportError(error, { where: "onboarding.referred_by" });
          }
        }
      }
    }

    // Vendeur / apporteur d'affaires : le cookie kado-aff (posé par le lien
    // ?ref=code) attribue ce client au vendeur. Tolérant : la table peut ne
    // pas exister encore.
    try {
      const affCode = (cookies().get("kado-aff")?.value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "");
      if (affCode) {
        const { data: aff } = await db
          .from("affiliates")
          .select("id, active")
          .eq("code", affCode)
          .maybeSingle();
        if (aff?.active) {
          const { error } = await db
            .from("businesses")
            .update({ affiliate_id: aff.id })
            .eq("id", biz.id);
          if (error && !isMissingColumnError(error)) {
            reportError(error, { where: "onboarding.affiliate_id" });
          }
        }
      }
    } catch {
      /* l'affiliation ne doit jamais bloquer une inscription */
    }

    // Config (thème) — nécessaire aussi pour les pages commande/suivi.
    await db.from("wheel_configs").insert({
      business_id: biz.id,
      primary_color: "#ffc24d",
      compliance_note: "Le cadeau n'est pas conditionné à la note laissée.",
      loyalty_enabled: plan === "fidelite" || plan === "complet",
    });
    // Le plan « Comptoir » n'a pas de jeu : on active directement le suivi au
    // comptoir et on ne crée aucun cadeau (pas de roue).
    if (plan === "comptoir") {
      // Écriture secondaire : colonne order_tracking absente → ignorée
      // (hasComptoir couvre le plan) ; vraie erreur → reportError, inscription
      // poursuivie (aucun 500 introduit).
      try {
        const { error } = await db
          .from("businesses")
          .update({ order_tracking: true })
          .eq("id", biz.id);
        if (error && !isMissingColumnError(error)) {
          reportError(error, { where: "onboarding.order_tracking" });
        }
      } catch (e) {
        reportError(e, { where: "onboarding.order_tracking" });
      }
    } else {
      const prizes = prizesForCategory(body.category);
      await insertPrizes(
        db,
        prizes.map((p, i) => ({ ...p, business_id: biz.id, position: i }))
      );
    }

    return Response.json({ ok: true, slug });
  },
});
