/**
 * Prospection Kado — (re)génération des messages d'un prospect avec la dernière
 * version des gabarits (partagé entre la route par prospect et « tout régénérer »).
 *
 * Règles de statut :
 *  - ENVOYÉ / IGNORÉ (`sent` / `skipped`) : jamais touché (déjà parti).
 *  - APPROUVÉ (`approved`) : contenu rafraîchi EN PLACE, statut conservé — permet
 *    de déployer un changement de gabarit sans avoir à ré-approuver en masse.
 *  - BROUILLON (`draft`) : remplacé par un brouillon à jour.
 * Nettoie aussi d'éventuels brouillons redondants quand un message approuvé existe.
 */
import type { getAdminClient } from "@/lib/supabase/admin";
import {
  renderEmail,
  renderDm,
  type GeneratedEmail,
  type TemplateContext,
} from "@/lib/prospection/templates";

type Db = ReturnType<typeof getAdminClient>;

export interface RegenTarget {
  id: string;
  name: string;
  city: string | null;
  category: string | null;
  google_reviews_count: number | null;
}

interface ExistingMessage {
  id: string;
  channel: string;
  status: string;
}

/**
 * (Re)génère les messages email + DM d'un prospect. Renvoie l'email généré
 * (pour un éventuel contrôle anti-spam en aval).
 */
export async function regenerateProspectMessages(
  db: Db,
  p: RegenTarget
): Promise<{ email: GeneratedEmail; dm: string }> {
  const ctx: TemplateContext = {
    name: p.name,
    city: p.city,
    category: p.category,
    google_reviews_count: p.google_reviews_count,
    seed: p.id,
  };
  const email = renderEmail(ctx);
  const dm = renderDm(ctx);

  const { data: existing } = await db
    .from("prospect_messages")
    .select("id, channel, status")
    .eq("prospect_id", p.id)
    .eq("step", 1);
  const rows = (existing ?? []) as ExistingMessage[];

  for (const channel of ["email", "instagram"] as const) {
    const chRows = rows.filter((r) => r.channel === channel);
    // Déjà parti (envoyé/ignoré) → on ne régénère pas ce canal.
    if (chRows.some((r) => r.status === "sent" || r.status === "skipped")) continue;

    const payload =
      channel === "email"
        ? { subject: email.subject, body: email.body }
        : { subject: null as string | null, body: dm };

    const approved = chRows.find((r) => r.status === "approved");
    if (approved) {
      // Rafraîchit le contenu approuvé en place (statut conservé).
      await db.from("prospect_messages").update(payload).eq("id", approved.id);
      // Supprime d'éventuels brouillons redondants du même canal.
      await db
        .from("prospect_messages")
        .delete()
        .eq("prospect_id", p.id)
        .eq("channel", channel)
        .eq("step", 1)
        .eq("status", "draft");
    } else {
      // Remplace le(s) brouillon(s) par un brouillon à jour.
      await db
        .from("prospect_messages")
        .delete()
        .eq("prospect_id", p.id)
        .eq("channel", channel)
        .eq("step", 1)
        .eq("status", "draft");
      await db
        .from("prospect_messages")
        .insert({ prospect_id: p.id, channel, step: 1, status: "draft", ...payload });
    }
  }

  return { email, dm };
}
