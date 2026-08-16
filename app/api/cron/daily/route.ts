import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { sendEmail, emailLayout, getOwnerContact } from "@/lib/email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SITE = "https://kado-app.fr";

/**
 * Tâche quotidienne (cron Vercel, 8h UTC) :
 * 1. Relance les essais qui se terminent dans ≤ 3 jours (une seule fois).
 * 2. Le lundi : récap hebdomadaire d'activité aux commerçants actifs.
 */
export async function GET(req: NextRequest) {
  // Vercel ajoute automatiquement "Authorization: Bearer <CRON_SECRET>"
  // quand la variable d'environnement CRON_SECRET est définie.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getAdminClient();
  const out = { reminders: 0, birthdays: 0, recaps: 0, errors: [] as string[] };

  // ── 1. Relance fin d'essai (J-3) ────────────────────────────────
  try {
    const now = Date.now();
    const { data: trials, error } = await db
      .from("businesses")
      .select("id, name, subscription_ends_at, trial_reminder_sent_at")
      .eq("subscription_status", "trial")
      .is("stripe_subscription_id", null)
      .gt("subscription_ends_at", new Date(now).toISOString())
      .lte("subscription_ends_at", new Date(now + 3 * 864e5).toISOString());
    if (error) throw new Error(error.message);

    for (const biz of trials ?? []) {
      if (biz.trial_reminder_sent_at) continue;
      const { email, businessName } = await getOwnerContact(db, biz.id);
      if (!email) continue;

      const daysLeft = Math.max(
        1,
        Math.ceil(
          (new Date(biz.subscription_ends_at).getTime() - now) / 864e5
        )
      );
      const res = await sendEmail({
        to: email,
        subject: `Votre essai gratuit se termine dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""}`,
        html: emailLayout({
          preview: "Gardez votre roue et votre carte de fidélité actives.",
          heading: `Plus que ${daysLeft} jour${daysLeft > 1 ? "s" : ""} d'essai !`,
          emoji: "⏳",
          bodyHtml: `Bonjour,<br><br>Votre essai gratuit de Kado${
            businessName ? ` pour <b>${businessName}</b>` : ""
          } se termine bientôt. Après cette date, votre page de jeu et votre carte de fidélité seront désactivées.<br><br>Pour continuer sans interruption, choisissez votre formule&nbsp;: <b>Roue 29&nbsp;€</b>, <b>Fidélité 19&nbsp;€</b> ou <b>Complet 44&nbsp;€</b> par mois, sans engagement.<br><br><a href="${SITE}/dashboard/billing" style="display:inline-block;background:linear-gradient(135deg,#ff6b4a,#ff4e87);color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:12px;">Choisir ma formule</a>`,
          footnote:
            "Résiliable à tout moment en un clic. Une question ? Répondez à cet e-mail.",
        }),
      });
      if (res.ok) {
        await db
          .from("businesses")
          .update({ trial_reminder_sent_at: new Date().toISOString() })
          .eq("id", biz.id);
        out.reminders++;
      }
    }
  } catch (e: any) {
    out.errors.push(`reminders: ${e?.message ?? "error"}`);
  }

  // ── 2. Anniversaires du jour ────────────────────────────────────
  try {
    const today = new Date();
    const day = today.getUTCDate();
    const month = today.getUTCMonth() + 1;
    const { data: cards, error } = await db
      .from("loyalty_cards")
      .select("id, email, business_id, birthday_sent_at, unsubscribed_at")
      .eq("birthday_day", day)
      .eq("birthday_month", month);
    if (error) throw new Error(error.message);

    if (cards && cards.length > 0) {
      const bizIds = [...new Set(cards.map((c) => c.business_id))];
      const [{ data: cfgs }, { data: bizs }] = await Promise.all([
        db
          .from("wheel_configs")
          .select("business_id, birthday_enabled, birthday_reward")
          .in("business_id", bizIds),
        db.from("businesses").select("id, name, status").in("id", bizIds),
      ]);
      const cfgBy = new Map((cfgs ?? []).map((c: any) => [c.business_id, c]));
      const bizBy = new Map((bizs ?? []).map((b: any) => [b.id, b]));
      const yearAgo = Date.now() - 300 * 864e5; // marge : 1 envoi max / ~an

      for (const c of cards) {
        const cfg: any = cfgBy.get(c.business_id);
        const biz: any = bizBy.get(c.business_id);
        if (!cfg?.birthday_enabled || !biz || biz.status !== "active") continue;
        if (c.unsubscribed_at) continue;
        if (
          c.birthday_sent_at &&
          new Date(c.birthday_sent_at).getTime() > yearAgo
        )
          continue;

        const res = await sendEmail({
          to: c.email,
          subject: `Joyeux anniversaire de la part de ${biz.name} ! 🎂`,
          fromName: `${biz.name} via Kado`,
          html: emailLayout({
            preview: "Une surprise vous attend.",
            heading: "Joyeux anniversaire ! 🎂",
            emoji: "🎉",
            bodyHtml: `Toute l'équipe de <b>${biz.name}</b> vous souhaite un très joyeux anniversaire !<br><br>Pour l'occasion&nbsp;: <b>${
              cfg.birthday_reward || "une surprise offerte"
            }</b>.<br><br>Montrez simplement cet e-mail en caisse lors de votre prochaine visite. À très vite !`,
            footnote:
              "Offre liée à votre carte de fidélité, valable une fois.",
          }),
        });
        if (res.ok) {
          await db
            .from("loyalty_cards")
            .update({ birthday_sent_at: new Date().toISOString() })
            .eq("id", c.id);
          out.birthdays++;
        }
      }
    }
  } catch (e: any) {
    out.errors.push(`birthdays: ${e?.message ?? "error"}`);
  }

  // ── 3. Récap hebdo (le lundi) ───────────────────────────────────
  try {
    const isMonday = new Date().getUTCDay() === 1;
    if (isMonday) {
      const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
      const fiveDaysAgo = new Date(Date.now() - 5 * 864e5).toISOString();
      const { data: actives, error } = await db
        .from("businesses")
        .select("id, name, slug, recap_sent_at")
        .eq("status", "active");
      if (error) throw new Error(error.message);

      for (const biz of actives ?? []) {
        // anti-doublon si le cron se déclenche deux fois
        if (biz.recap_sent_at && biz.recap_sent_at > fiveDaysAgo) continue;

        const [{ data: plays }, { count: leads }, { count: fidNew }] =
          await Promise.all([
            db
              .from("plays")
              .select("prize_label")
              .eq("business_id", biz.id)
              .gte("created_at", weekAgo),
            db
              .from("leads")
              .select("*", { count: "exact", head: true })
              .eq("business_id", biz.id)
              .gte("created_at", weekAgo),
            db
              .from("loyalty_cards")
              .select("*", { count: "exact", head: true })
              .eq("business_id", biz.id)
              .gte("created_at", weekAgo),
          ]);

        const tours = plays?.length ?? 0;
        const gagnes = (plays ?? []).filter(
          (p) => p.prize_label && !p.prize_label.toLowerCase().includes("rien")
        ).length;
        const emails = leads ?? 0;
        const fid = fidNew ?? 0;
        if (tours + emails + fid === 0) continue; // rien à raconter

        const { email } = await getOwnerContact(db, biz.id);
        if (!email) continue;

        const res = await sendEmail({
          to: email,
          subject: `Votre semaine Kado — ${tours} tour${tours > 1 ? "s" : ""} joué${tours > 1 ? "s" : ""}`,
          html: emailLayout({
            preview: "Le résumé d'activité de votre commerce.",
            heading: "Votre semaine en un coup d'œil",
            emoji: "📊",
            bodyHtml: `Bonjour,<br><br>Voici l'activité de <b>${biz.name}</b> ces 7 derniers jours&nbsp;:<br><br><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:15px;line-height:2;"><tr><td>🎡 Tours de roue joués</td><td align="right"><b>${tours}</b></td></tr><tr><td>🎁 Cadeaux gagnés</td><td align="right"><b>${gagnes}</b></td></tr><tr><td>📧 E-mails clients capturés</td><td align="right"><b>${emails}</b></td></tr><tr><td>🎟️ Nouvelles cartes de fidélité</td><td align="right"><b>${fid}</b></td></tr></table><br><a href="${SITE}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#ff6b4a,#ff4e87);color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:12px;">Voir mon tableau de bord</a>`,
            footnote:
              "Astuce : plus votre affiche QR est visible, plus vos clients jouent.",
          }),
        });
        if (res.ok) {
          await db
            .from("businesses")
            .update({ recap_sent_at: new Date().toISOString() })
            .eq("id", biz.id);
          out.recaps++;
        }
      }
    }
  } catch (e: any) {
    out.errors.push(`recaps: ${e?.message ?? "error"}`);
  }

  return Response.json({ ok: true, ...out });
}
