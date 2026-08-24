import { z } from "zod";
import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { sendEmail, emailLayout } from "@/lib/email";

const PostBody = z.object({
  name: z.any().optional(),
  email: z.any().optional(),
  code: z.any().optional(),
  commission_roue: z.any().optional(),
  commission_fidelite: z.any().optional(),
  commission_complet: z.any().optional(),
});

const PatchBody = z.object({
  id: z.any().optional(),
  action: z.any().optional(),
});

/** Crée un vendeur (apporteur d'affaires) avec son code de lien. */
export const POST = adminRoute({
  schema: PostBody,
  handler: async ({ body }) => {
    const name = (body.name || "").trim();
    if (!name) return Response.json({ error: "name_required" }, { status: 400 });
    const email = (body.email || "").trim().toLowerCase() || null;

    // Code du lien : celui fourni, sinon dérivé du nom (paul-martin → paul-martin)
    const code = (body.code || name)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 40);
    if (!code) return Response.json({ error: "code_required" }, { status: 400 });

    // Montants en euros → centimes (bornés 0..1000 €), défauts 30/20/45
    // (≈ 1er mois d'abonnement arrondi, versé après le 2e prélèvement).
    const cents = (v: unknown, dflt: number) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 1000) return dflt;
      return Math.round(n * 100);
    };

    const db = getAdminClient();
    const { data, error } = await db
      .from("affiliates")
      .insert({
        name,
        email,
        code,
        commission_roue_cents: cents(body.commission_roue, 3000),
        commission_fidelite_cents: cents(body.commission_fidelite, 2000),
        commission_complet_cents: cents(body.commission_complet, 4500),
      })
      .select("id, code")
      .single();

    if (error) {
      const dup = /duplicate|unique/i.test(error.message);
      return Response.json(
        { error: dup ? "code_taken" : "create_failed" },
        { status: dup ? 409 : 500 }
      );
    }
    return Response.json({ ok: true, id: data.id, code: data.code });
  },
});

/** Active/désactive un vendeur, ou marque ses commissions comme payées. */
export const PATCH = adminRoute({
  schema: PatchBody,
  handler: async ({ body }) => {
    const id = (body.id || "").trim();
    if (!id) return Response.json({ error: "id_required" }, { status: 400 });

    const db = getAdminClient();

    // Commissions dues du vendeur, avec l'état d'abonnement du client :
    // exigible = client toujours actif ET 2e prélèvement passé (~30 jours).
    async function dueWithBizStatus(affiliateId: string) {
      const { data: comms } = await db
        .from("affiliate_commissions")
        .select("id, business_id, created_at")
        .eq("affiliate_id", affiliateId)
        .eq("status", "due");
      const list = comms ?? [];
      if (list.length === 0) return [];
      const { data: bizs } = await db
        .from("businesses")
        .select("id, subscription_status")
        .in("id", list.map((c) => c.business_id));
      const statusById = new Map(
        (bizs ?? []).map((b) => [b.id, b.subscription_status])
      );
      return list.map((c) => ({
        ...c,
        bizActive: ["active", "trial"].includes(
          statusById.get(c.business_id) ?? ""
        ),
      }));
    }
    const THIRTY_DAYS = 30 * 864e5;

    if (body.action === "mark_paid") {
      // Seules les commissions EXIGIBLES → payées (après facture + virement).
      const due = await dueWithBizStatus(id);
      const ids = due
        .filter(
          (c) =>
            c.bizActive &&
            Date.now() - new Date(c.created_at).getTime() >= THIRTY_DAYS
        )
        .map((c) => c.id);
      if (ids.length === 0) return Response.json({ ok: true, paid: 0 });
      const { error } = await db
        .from("affiliate_commissions")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .in("id", ids);
      if (error) return Response.json({ error: "update_failed" }, { status: 500 });
      return Response.json({ ok: true, paid: ids.length });
    }

    if (body.action === "cancel_lapsed") {
      // Client parti avant son 2e prélèvement : commission caduque (contrat).
      const due = await dueWithBizStatus(id);
      const ids = due.filter((c) => !c.bizActive).map((c) => c.id);
      if (ids.length === 0) return Response.json({ ok: true, canceled: 0 });
      const { error } = await db
        .from("affiliate_commissions")
        .update({ status: "canceled" })
        .in("id", ids);
      if (error) return Response.json({ error: "update_failed" }, { status: 500 });
      return Response.json({ ok: true, canceled: ids.length });
    }

    if (body.action === "toggle_active") {
      const { data: aff } = await db
        .from("affiliates")
        .select("active, name, email, code")
        .eq("id", id)
        .maybeSingle();
      if (!aff) return Response.json({ error: "not_found" }, { status: 404 });
      const nowActive = !aff.active;
      const { error } = await db
        .from("affiliates")
        .update({ active: nowActive })
        .eq("id", id);
      if (error) return Response.json({ error: "update_failed" }, { status: 500 });

      // Activation d'une candidature : e-mail de bienvenue avec son lien.
      if (nowActive && aff.email) {
        try {
          await sendEmail({
            to: aff.email,
            subject: "Votre lien promoteur Kado est activé ! 🚀",
            html: emailLayout({
              preview: "Vous pouvez commencer à recommander Kado.",
              heading: "Bienvenue dans le programme ! 🤝",
              emoji: "🚀",
              bodyHtml: `Bonjour ${aff.name},<br><br>Votre profil promoteur est <b>activé</b>. Votre lien personnel :<br><br><b>https://kado-app.fr?ref=${aff.code}</b><br><br>Chaque commerce qui s'inscrit via ce lien puis s'abonne vous rapporte une commission (Fidélité 20&nbsp;€ · Jeux 30&nbsp;€ · Complet 45&nbsp;€), versée après son 2ᵉ prélèvement sur simple facture.<br><br>Suivez vos résultats en temps réel sur <a href="https://kado-app.fr/vendeur">kado-app.fr/vendeur</a> (connectez-vous avec cet e-mail) — la plaquette de vente y est téléchargeable.`,
            }),
          });
        } catch {
          /* l'e-mail ne doit pas bloquer l'activation */
        }
      }
      return Response.json({ ok: true, active: nowActive });
    }

    return Response.json({ error: "unknown_action" }, { status: 400 });
  },
});
