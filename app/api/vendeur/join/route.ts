import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { cleanAffiliateCode, DEFAULT_COMMISSIONS } from "@/lib/affiliates";
import { sendEmail, emailLayout } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Candidature « Devenir promoteur » : l'utilisateur connecté dépose son
 * profil (un seul par compte), créé INACTIF. L'admin le contacte, fait
 * signer le contrat, puis l'active depuis Admin → Vendeurs — rien n'est
 * attribué ni commissionné avant. Barème par défaut 20/30/45 €.
 */
export async function POST(req: NextRequest) {
  let user: Awaited<ReturnType<typeof getSessionUser>> = null;
  try {
    user = await getSessionUser();
  } catch {
    user = null; // auth non configurée = non connecté
  }
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const db = getAdminClient();

  // Déjà promoteur ? on renvoie son profil sans dupliquer.
  try {
    const { data: existing } = await db
      .from("affiliates")
      .select("id, code")
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (existing) return Response.json({ ok: true, code: existing.code });
  } catch {
    /* colonne absente : la création échouera plus bas avec un message clair */
  }

  let body: { name?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const name = (body.name || "").trim().slice(0, 80);
  if (!name) return Response.json({ error: "name_required" }, { status: 400 });

  const wanted = cleanAffiliateCode(body.code || name);
  if (!wanted) return Response.json({ error: "code_required" }, { status: 400 });

  // Code unique : celui demandé, sinon suffixe -2, -3…
  let created: { id: string; code: string } | null = null;
  for (let i = 0; i < 10 && !created; i++) {
    const code = i === 0 ? wanted : `${wanted}-${i + 1}`;
    const { data, error } = await db
      .from("affiliates")
      .insert({
        name,
        email: user.email ?? null,
        code,
        owner_user_id: user.id,
        active: false, // candidature : l'admin active après contact + contrat
        commission_roue_cents: DEFAULT_COMMISSIONS.roue,
        commission_fidelite_cents: DEFAULT_COMMISSIONS.fidelite,
        commission_complet_cents: DEFAULT_COMMISSIONS.complet,
      })
      .select("id, code")
      .single();
    if (!error && data) created = data;
    else if (error && !/duplicate|unique/i.test(error.message)) {
      return Response.json({ error: "create_failed" }, { status: 500 });
    }
  }
  if (!created) return Response.json({ error: "code_taken" }, { status: 409 });

  // Prévenir l'admin : un nouveau promoteur s'est inscrit.
  try {
    const adminEmail = (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim();
    if (adminEmail) {
      await sendEmail({
        to: adminEmail,
        subject: `Candidature promoteur à valider — ${name}`,
        html: emailLayout({
          preview: "Quelqu'un souhaite devenir promoteur Kado.",
          heading: "Nouvelle candidature ! 🤝",
          emoji: "🤝",
          bodyHtml: `<b>${name}</b> (${
            user.email ?? "e-mail inconnu"
          }) souhaite devenir promoteur.<br>Code demandé : <b>${
            created.code
          }</b><br><br>Son profil est <b>inactif</b> : son lien ne rapporte rien tant que vous ne l'avez pas activé.<br><br>1. Contactez-le et envoyez-lui le contrat d'apporteur d'affaires<br>2. Contrat signé → cliquez « Activer » dans <a href="https://kado-app.fr/admin/vendeurs">Admin → Vendeurs</a>.`,
        }),
      });
    }
  } catch {
    /* l'e-mail ne doit pas bloquer l'inscription */
  }

  return Response.json({ ok: true, code: created.code });
}
