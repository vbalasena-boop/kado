import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { cleanAffiliateCode, DEFAULT_COMMISSIONS } from "@/lib/affiliates";
import { sendEmail, emailLayout } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * « Devenir promoteur » en libre-service : l'utilisateur connecté crée son
 * profil vendeur (un seul par compte). Barème par défaut 20/30/45 €.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
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
        subject: `Nouveau promoteur inscrit — ${name}`,
        html: emailLayout({
          preview: "Un promoteur vient de rejoindre le programme.",
          heading: "Nouveau promoteur ! 🤝",
          emoji: "🤝",
          bodyHtml: `<b>${name}</b> (${
            user.email ?? "e-mail inconnu"
          }) vient de s'inscrire comme promoteur.<br>Code : <b>${
            created.code
          }</b><br><br>Pensez à lui envoyer le contrat d'apporteur d'affaires — retrouvez-le dans <a href="https://kado-app.fr/admin/vendeurs">Admin → Vendeurs</a>.`,
        }),
      });
    }
  } catch {
    /* l'e-mail ne doit pas bloquer l'inscription */
  }

  return Response.json({ ok: true, code: created.code });
}
