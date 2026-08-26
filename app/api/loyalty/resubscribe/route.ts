import { z } from "zod";
import { publicRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { sendEmail, emailLayout } from "@/lib/email";
import { buildResubConfirmUrl } from "@/lib/resubscribe";
import { escapeHtml } from "@/lib/campaigns";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Schéma permissif : la validation métier reste dans le handler.
const Body = z.object({
  slug: z.string().optional(),
  email: z.string().optional(),
});

/**
 * Demande de ré-abonnement (double opt-in, étape 1/2).
 *
 * Envoie un e-mail de confirmation avec lien signé UNIQUEMENT si la carte
 * existe ET est désinscrite. NE rétablit PAS le consentement (aucune écriture).
 * Réponse toujours neutre `{ ok: true }` (anti-énumération : on ne révèle
 * jamais si un e-mail est connu / inscrit).
 */
export const POST = publicRoute({
  schema: Body,
  // Anti-abus : 10 demandes/min max par IP
  rateLimit: { key: ({ ip }) => `resub:${ip}`, limit: 10, windowSeconds: 60 },
  handler: async ({ body }) => {
    const slug = (body.slug || "").trim();
    const email = (body.email || "").trim().toLowerCase();

    // Entrée invalide → réponse neutre (pas d'indice), aucun envoi.
    if (!slug || !EMAIL_RE.test(email)) {
      return Response.json({ ok: true });
    }

    try {
      const db = getAdminClient();
      const { data: biz } = await db
        .from("businesses")
        .select("id, name, status")
        .eq("slug", slug)
        .maybeSingle();

      if (biz && biz.status === "active") {
        const { data: card } = await db
          .from("loyalty_cards")
          .select("id, unsubscribed_at")
          .eq("business_id", biz.id)
          .eq("email", email)
          .maybeSingle();

        // On n'envoie l'e-mail que si la carte existe ET est désinscrite.
        if (card && (card as any).unsubscribed_at) {
          const { url } = buildResubConfirmUrl(
            biz.id,
            email,
            (card as any).unsubscribed_at
          );
          const name = biz.name || "ce commerce";
          // Envoi jamais bloquant : on ignore le résultat.
          await sendEmail({
            to: email,
            subject: `Confirmer votre ré-abonnement aux offres de ${name}`,
            fromName: `${name} via Kado`,
            // Transactionnel (double opt-in) : PAS l'adresse marketing, pour
            // maximiser la délivrabilité auprès d'un destinataire désinscrit.
            marketing: false,
            html: emailLayout({
              preview: `Confirmez votre ré-abonnement aux offres de ${escapeHtml(
                name
              )}`,
              heading: "Confirmez votre ré-abonnement",
              emoji: "💌",
              bodyHtml:
                `Vous avez demandé à recevoir de nouveau les offres de ` +
                `<b>${escapeHtml(name)}</b>. Pour confirmer votre ` +
                `ré-abonnement, cliquez sur le bouton ci-dessous.` +
                `<br><br><a href="${url}" style="display:inline-block;` +
                `background:linear-gradient(135deg,#ff6b4a,#ff4e87);color:#fff;` +
                `text-decoration:none;font-weight:700;padding:12px 22px;` +
                `border-radius:12px;">Confirmer mon ré-abonnement</a>` +
                `<br><br>Si vous n'êtes pas à l'origine de cette demande, ` +
                `ignorez simplement cet e-mail : rien ne changera.`,
              footnote: `Ce lien est valable 48 heures.`,
            }),
          });
        }
      }
    } catch {
      // Lectures/écritures tolérantes : on ne divulgue jamais d'erreur.
    }

    // Réponse neutre systématique (anti-énumération).
    return Response.json({ ok: true });
  },
});
