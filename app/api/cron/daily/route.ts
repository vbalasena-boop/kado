import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { reportError } from "@/lib/report";
import { isMissingColumnError } from "@/lib/db-errors";
import {
  sendEmail,
  sendBatch,
  emailLayout,
  getOwnerContact,
} from "@/lib/email";
import {
  buildCampaignAudience,
  buildCampaignPayloads,
  escapeHtml,
  DAILY_CHUNK,
} from "@/lib/campaigns";
import { unsubToken } from "@/lib/unsub";
import { isAlmostNudgeEligible } from "@/lib/reengage";
import { mapLimit } from "@/lib/async";
import { setSystemState } from "@/lib/health";
import { sendPushToClients } from "@/lib/push";
import { generateCode, labelIsLosing } from "@/lib/draw";

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
  // Sécurité : le secret est EXIGÉ. Sans lui (ou avec un en-tête invalide) on
  // refuse — sinon un endpoint oublié laisserait n'importe qui déclencher les
  // envois d'e-mails et le tirage au sort. CRON_SECRET doit être défini côté
  // Vercel (Settings → Environment Variables) pour que le cron s'exécute.
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getAdminClient();
  const out = {
    reminders: 0,
    birthdays: 0,
    campaigns: 0,
    recaps: 0,
    draws: 0,
    consentPurged: 0,
    reengageAlmost: 0,
    errors: [] as string[],
  };

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

    // Envois parallélisés (concurrence bornée) pour tenir dans maxDuration.
    await mapLimit(trials ?? [], 5, async (biz) => {
      if (biz.trial_reminder_sent_at) return;
      const { email, businessName } = await getOwnerContact(db, biz.id);
      if (!email) return;

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
          } se termine bientôt. Après cette date, votre page de jeu et votre carte de fidélité seront désactivées.<br><br>Pour continuer sans interruption, choisissez votre formule&nbsp;: <b>Jeux 29&nbsp;€</b>, <b>Fidélité 19&nbsp;€</b> ou <b>Complet 44&nbsp;€</b> par mois, sans engagement.<br><br><a href="${SITE}/dashboard/billing" style="display:inline-block;background:linear-gradient(135deg,#ff6b4a,#ff4e87);color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:12px;">Choisir ma formule</a>`,
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
    });
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

      await mapLimit(cards, 5, async (c) => {
        const cfg: any = cfgBy.get(c.business_id);
        const biz: any = bizBy.get(c.business_id);
        if (!cfg?.birthday_enabled || !biz || biz.status !== "active") return;
        if (c.unsubscribed_at) return;
        if (
          c.birthday_sent_at &&
          new Date(c.birthday_sent_at).getTime() > yearAgo
        )
          return;

        const unsub = `${SITE}/api/unsubscribe?b=${c.business_id}&e=${encodeURIComponent(
          Buffer.from(c.email).toString("base64url")
        )}&t=${unsubToken(c.business_id, c.email)}`;
        const res = await sendEmail({
          to: c.email,
          subject: `Joyeux anniversaire de la part de ${biz.name} ! 🎂`,
          fromName: `${biz.name} via Kado`,
          marketing: true,
          html: emailLayout({
            preview: "Une surprise vous attend.",
            heading: "Joyeux anniversaire ! 🎂",
            emoji: "🎉",
            bodyHtml: `Toute l'équipe de <b>${biz.name}</b> vous souhaite un très joyeux anniversaire !<br><br>Pour l'occasion&nbsp;: <b>${
              cfg.birthday_reward || "une surprise offerte"
            }</b>.<br><br>Montrez simplement cet e-mail en caisse lors de votre prochaine visite. À très vite !`,
            footnote: `Offre liée à votre carte de fidélité, valable une fois. <a href="${unsub}" style="color:#9a94b4;">Ne plus recevoir ces e-mails</a>`,
          }),
        });
        if (res.ok) {
          await db
            .from("loyalty_cards")
            .update({ birthday_sent_at: new Date().toISOString() })
            .eq("id", c.id);
          out.birthdays++;
        }
      });
    }
  } catch (e: any) {
    out.errors.push(`birthdays: ${e?.message ?? "error"}`);
  }

  // ── 2b. Relance fidélité « plus qu'un tampon » ──────────────────
  // Commerces AYANT ACTIVÉ la relance : on repère les cartes à `objectif - 1`
  // et on envoie un rappel (une fois par cycle, cf. isAlmostNudgeEligible).
  try {
    const { data: rcfgs, error: rcErr } = await db
      .from("wheel_configs")
      .select("business_id, loyalty_goal, loyalty_reward, loyalty_reward_emoji")
      .eq("reengage_almost", true)
      .eq("loyalty_enabled", true);
    if (rcErr) {
      // Colonne 0056 absente → fonctionnalité pas encore déployée : on ignore.
      if (!isMissingColumnError(rcErr)) {
        out.errors.push(`reengage_almost: ${rcErr.message}`);
      }
    } else if ((rcfgs ?? []).length) {
      const ids = [...new Set((rcfgs as any[]).map((c) => c.business_id))];
      const { data: bizs } = await db
        .from("businesses")
        .select("id, name, status")
        .in("id", ids);
      const bizBy = new Map((bizs ?? []).map((b: any) => [b.id, b]));

      for (const cfg of rcfgs as any[]) {
        const biz: any = bizBy.get(cfg.business_id);
        if (!biz || biz.status !== "active") continue;
        const goal = Number(cfg.loyalty_goal) || 0;
        if (goal < 2) continue;

        const { data: cards } = await db
          .from("loyalty_cards")
          .select(
            "id, email, stamps, reward_ready, marketing_ok, unsubscribed_at, last_stamp_at, nudge_almost_at"
          )
          .eq("business_id", cfg.business_id)
          .eq("stamps", goal - 1)
          .eq("reward_ready", false)
          .eq("marketing_ok", true)
          .is("unsubscribed_at", null);

        const eligible = (cards ?? []).filter((c: any) =>
          isAlmostNudgeEligible(c, goal)
        );
        const reward = escapeHtml(
          (cfg.loyalty_reward || "votre récompense").toString()
        );
        const emoji = escapeHtml((cfg.loyalty_reward_emoji || "🎁").toString());
        const shop = escapeHtml(biz.name || "votre commerce");

        await mapLimit(eligible, 5, async (c: any) => {
          const unsub = `${SITE}/api/unsubscribe?b=${cfg.business_id}&e=${encodeURIComponent(
            Buffer.from(c.email).toString("base64url")
          )}&t=${unsubToken(cfg.business_id, c.email)}`;
          const res = await sendEmail({
            to: c.email,
            subject: `Plus qu'un tampon chez ${biz.name} ! ${cfg.loyalty_reward_emoji || "🎁"}`,
            fromName: `${biz.name} via Kado`,
            marketing: true,
            html: emailLayout({
              preview: "Il ne vous manque qu'un seul tampon !",
              heading: "Plus qu'un tampon ! 🎯",
              emoji: cfg.loyalty_reward_emoji || "🎁",
              bodyHtml: `Bonne nouvelle : il ne vous manque plus qu'<b>un seul tampon</b> chez <b>${shop}</b> pour débloquer <b>${emoji} ${reward}</b>.<br><br>Passez nous voir lors de votre prochaine visite pour compléter votre carte&nbsp;!`,
              footnote: `Message lié à votre carte de fidélité. <a href="${unsub}" style="color:#9a94b4;">Ne plus recevoir ces e-mails</a>`,
            }),
          });
          if (res.ok) {
            await db
              .from("loyalty_cards")
              .update({ nudge_almost_at: new Date().toISOString() })
              .eq("id", c.id);
            out.reengageAlmost++;
          }
        });
      }
    }
  } catch (e: any) {
    out.errors.push(`reengage_almost: ${e?.message ?? "error"}`);
  }

  // ── 3a. Campagnes programmées arrivées à échéance ───────────────
  // On les transforme en file d'envoi étalé (traitée juste après).
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    // Sélection tolérante : la colonne channel peut manquer (migration 0026)
    let due: any[] | null = null;
    {
      const r1 = await db
        .from("campaigns")
        .select("id, business_id, subject, body, channel")
        .is("sent_at", null)
        .not("scheduled_for", "is", null)
        .lte("scheduled_for", todayStr);
      if (!r1.error) due = r1.data;
      else {
        const r2 = await db
          .from("campaigns")
          .select("id, business_id, subject, body")
          .is("sent_at", null)
          .not("scheduled_for", "is", null)
          .lte("scheduled_for", todayStr);
        if (r2.error) throw new Error(r2.error.message);
        due = r2.data;
      }
    }

    for (const c of due ?? []) {
      const { data: biz } = await db
        .from("businesses")
        .select("id, name, slug, status, subscription_status, campaigns_addon")
        .eq("id", c.business_id)
        .maybeSingle();
      const entitled =
        biz &&
        biz.status === "active" &&
        (biz.subscription_status === "trial" || (biz as any).campaigns_addon);
      if (!entitled) {
        // commerce inactif ou option résiliée : classée sans envoi
        await db
          .from("campaigns")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", c.id);
        continue;
      }
      const channel = ["email", "push", "both"].includes(c.channel)
        ? c.channel
        : "both";
      // Push aux clients abonnés aux offres, au démarrage de la campagne
      let pushed = 0;
      if (channel !== "email") {
        try {
          pushed = await sendPushToClients(db, c.business_id, {
            title: `${biz.name} : ${c.subject}`.slice(0, 80),
            body: String(c.body ?? "").slice(0, 140),
            url: `/${biz.slug}`,
          });
        } catch {
          /* jamais bloquant */
        }
      }
      const audience =
        channel !== "push"
          ? await buildCampaignAudience(db, c.business_id)
          : [];
      await db
        .from("campaigns")
        .update({
          scheduled_for: null,
          ...(audience.length > 0
            ? { pending_recipients: audience }
            : { sent_at: new Date().toISOString() }),
        })
        .eq("id", c.id);
      // compteur push (tolérant si la colonne manque ; sinon on ne gobe plus
      // une vraie panne — le cron poursuit quoi qu'il arrive).
      if (pushed > 0) {
        try {
          const { error } = await db
            .from("campaigns")
            .update({ pushed_count: pushed })
            .eq("id", c.id);
          if (error && !isMissingColumnError(error)) {
            reportError(error, { where: "cron/daily.pushed_count", campaign: c.id });
          }
        } catch (e) {
          reportError(e, { where: "cron/daily.pushed_count", campaign: c.id });
        }
      }
    }
  } catch (e: any) {
    out.errors.push(`scheduled: ${e?.message ?? "error"}`);
  }

  // ── 3b. Envoi étalé : une fournée par jour et par campagne ──────
  try {
    const { data: drips, error } = await db
      .from("campaigns")
      .select("id, business_id, subject, body, sent_count, pending_recipients")
      .is("sent_at", null)
      .not("pending_recipients", "is", null);
    if (error) throw new Error(error.message);

    for (const c of drips ?? []) {
      const pending: string[] = (c as any).pending_recipients ?? [];
      if (pending.length === 0) {
        await db
          .from("campaigns")
          .update({ pending_recipients: null, sent_at: new Date().toISOString() })
          .eq("id", c.id);
        continue;
      }
      const { data: biz } = await db
        .from("businesses")
        .select("id, name, slug, status, subscription_status, campaigns_addon")
        .eq("id", c.business_id)
        .maybeSingle();
      const entitled =
        biz &&
        biz.status === "active" &&
        (biz.subscription_status === "trial" || (biz as any).campaigns_addon);
      if (!entitled) {
        await db
          .from("campaigns")
          .update({ pending_recipients: null, sent_at: new Date().toISOString() })
          .eq("id", c.id);
        continue;
      }

      const chunk = pending.slice(0, DAILY_CHUNK);
      const rest = pending.slice(DAILY_CHUNK);
      const { email: owner } = await getOwnerContact(db, biz.id);
      const sent = await sendBatch(
        buildCampaignPayloads(
          { id: biz.id, name: biz.name, slug: biz.slug },
          owner ?? undefined,
          c.subject,
          c.body,
          chunk
        )
      );
      await db
        .from("campaigns")
        .update({
          sent_count: (c.sent_count || 0) + sent,
          ...(rest.length > 0
            ? { pending_recipients: rest }
            : { pending_recipients: null, sent_at: new Date().toISOString() }),
        })
        .eq("id", c.id);
      out.campaigns++;
    }
  } catch (e: any) {
    out.errors.push(`campaigns: ${e?.message ?? "error"}`);
  }

  // ── 4. Récap hebdo (le lundi) ───────────────────────────────────
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

      await mapLimit(actives ?? [], 5, async (biz) => {
        // anti-doublon si le cron se déclenche deux fois
        if (biz.recap_sent_at && biz.recap_sent_at > fiveDaysAgo) return;

        const [
          { data: plays },
          { count: leads },
          { count: fidNew },
          { count: redeemed },
        ] = await Promise.all([
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
          db
            .from("plays")
            .select("*", { count: "exact", head: true })
            .eq("business_id", biz.id)
            .not("redeemed_at", "is", null)
            .gte("redeemed_at", weekAgo),
        ]);

        const tours = plays?.length ?? 0;
        const gagnes = (plays ?? []).filter(
          (p) => !labelIsLosing(p.prize_label)
        ).length;
        const emails = leads ?? 0;
        const fid = fidNew ?? 0;
        const echanges = redeemed ?? 0;
        if (tours + emails + fid === 0) return; // rien à raconter

        const { email } = await getOwnerContact(db, biz.id);
        if (!email) return;

        const res = await sendEmail({
          to: email,
          subject: `Votre semaine Kado — ${tours} tour${tours > 1 ? "s" : ""} joué${tours > 1 ? "s" : ""}`,
          html: emailLayout({
            preview: "Le résumé d'activité de votre commerce.",
            heading: "Votre semaine en un coup d'œil",
            emoji: "📊",
            bodyHtml: `Bonjour,<br><br>Voici l'activité de <b>${biz.name}</b> ces 7 derniers jours&nbsp;:<br><br><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:15px;line-height:2;"><tr><td>🎡 Parties jouées</td><td align="right"><b>${tours}</b></td></tr><tr><td>🎁 Cadeaux gagnés</td><td align="right"><b>${gagnes}</b></td></tr><tr><td>🛍️ Cadeaux échangés en caisse</td><td align="right"><b>${echanges}</b></td></tr><tr><td>📧 E-mails clients capturés</td><td align="right"><b>${emails}</b></td></tr><tr><td>🎟️ Nouvelles cartes de fidélité</td><td align="right"><b>${fid}</b></td></tr></table><br><a href="${SITE}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#ff6b4a,#ff4e87);color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:12px;">Voir mon tableau de bord</a>`,
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
      });
    }
  } catch (e: any) {
    out.errors.push(`recaps: ${e?.message ?? "error"}`);
  }

  // ── 5. Tirage au sort programmé (fréquence + date choisies) ─────
  try {
    const now = new Date();
    const nowIso = now.toISOString();
    // Inversion N+1 (Perf P4) : au lieu de scanner TOUS les commerces actifs
    // avec une requête wheel_configs chacun, on récupère directement les configs
    // « tirage activé » (ensemble bien plus petit) puis leurs commerces en un
    // seul `.in()`. Lecture tolérante : colonnes 0030/0031 absentes → bloc sauté.
    const { data: drawConfigs, error: dcErr } = await db
      .from("wheel_configs")
      .select(
        "business_id, monthly_draw, monthly_draw_prize, draw_period_days, draw_next_at"
      )
      .eq("monthly_draw", true);
    const drawList = dcErr ? [] : ((drawConfigs as any[]) ?? []);
    let drawBizById = new Map<string, any>();
    if (drawList.length) {
      const ids = Array.from(new Set(drawList.map((c) => c.business_id)));
      const { data: bizRows } = await db
        .from("businesses")
        .select("id, name, status")
        .in("id", ids)
        .eq("status", "active");
      drawBizById = new Map((bizRows ?? []).map((b: any) => [b.id, b]));
    }

    for (const cfg2 of drawList) {
      // Commerce inactif/supprimé (ou hors du set actif) → on ignore ce tirage.
      const biz = drawBizById.get(cfg2.business_id);
      if (!biz) continue;

      const period = Math.min(365, Math.max(1, Number(cfg2.draw_period_days) || 30));

      // Pas de date programmée → on programme le prochain sans tirer maintenant.
      if (!cfg2.draw_next_at) {
        await db
          .from("wheel_configs")
          .update({ draw_next_at: new Date(Date.now() + period * 864e5).toISOString() })
          .eq("business_id", biz.id);
        continue;
      }
      // Pas encore l'heure ?
      if (cfg2.draw_next_at > nowIso) continue;

      // Participants : e-mails uniques laissés depuis la fenêtre = une période
      const windowStart = new Date(Date.now() - period * 864e5).toISOString();
      const { data: entries } = await db
        .from("leads")
        .select("email")
        .eq("business_id", biz.id)
        .gte("created_at", windowStart)
        .not("email", "is", null);
      const emails = Array.from(
        new Set(
          (entries ?? [])
            .map((e) => (e.email || "").trim().toLowerCase())
            .filter(Boolean)
        )
      );

      // Reprogramme le prochain tirage (ancré sur la date, rattrape si en retard)
      let next = new Date(cfg2.draw_next_at);
      do {
        next = new Date(next.getTime() + period * 864e5);
      } while (next <= now);
      const reprog = {
        draw_next_at: next.toISOString(),
        monthly_draw_at: nowIso,
      };

      if (emails.length === 0) {
        await db.from("wheel_configs").update(reprog).eq("business_id", biz.id);
        continue;
      }

      const winner = emails[Math.floor(Math.random() * emails.length)];
      const prize =
        (cfg2.monthly_draw_prize || "").trim() || "un cadeau spécial";
      const code = generateCode();

      // E-mail au gagnant
      await sendEmail({
        to: winner,
        subject: `🎉 Vous avez gagné le tirage au sort chez ${biz.name} !`,
        html: emailLayout({
          preview: "Bonne nouvelle : vous êtes le gagnant du tirage !",
          heading: "🎉 Vous avez gagné !",
          emoji: "🎲",
          bodyHtml: `Bonjour,<br><br>Bravo&nbsp;! Vous avez été tiré(e) au sort parmi les participants chez <b>${biz.name}</b>.<br><br>Votre lot&nbsp;: <b>${prize}</b><br><br>Présentez ce code en boutique pour le récupérer&nbsp;:<br><br><div style="font-size:26px;font-weight:800;letter-spacing:3px;background:#f6f1ff;color:#1b1035;padding:14px;border-radius:12px;text-align:center;">${code}</div><br>À très vite&nbsp;!`,
          footnote: "Jeu gratuit sans obligation d'achat.",
        }),
      });

      // E-mail au commerçant (avec l'identité du gagnant)
      const { email: owner } = await getOwnerContact(db, biz.id);
      if (owner) {
        await sendEmail({
          to: owner,
          subject: `Tirage au sort — votre gagnant (${biz.name})`,
          html: emailLayout({
            preview: "Le gagnant du tirage a été désigné.",
            heading: "Votre tirage au sort",
            emoji: "🎲",
            bodyHtml: `Le tirage au sort de <b>${biz.name}</b> a désigné un gagnant&nbsp;:<br><br>👤 <b>${winner}</b><br>🎁 Lot&nbsp;: <b>${prize}</b><br>🔑 Code&nbsp;: <b>${code}</b><br><br>Le gagnant a reçu ce code par e-mail. Remettez-lui son lot lorsqu'il le présente en caisse.<br><br>Prochain tirage&nbsp;: <b>${next.toLocaleDateString("fr-FR")}</b>.`,
            footnote: `${emails.length} participant${emails.length > 1 ? "s" : ""} sur cette période.`,
          }),
        });
      }

      await db.from("wheel_configs").update(reprog).eq("business_id", biz.id);
      out.draws++;
    }
  } catch (e: any) {
    out.errors.push(`draws: ${e?.message ?? "error"}`);
  }

  // ── 6. Purge RGPD du journal de consentement (rétention ~3 ans) ─────────
  // Supprime les événements anciens DÉJÀ remplacés par un plus récent ; le
  // dernier état de chaque sujet est toujours conservé (cf. migration 0052).
  // Tolérant : si la fonction n'est pas encore déployée, on ignore sans casser.
  try {
    const { data, error } = await db.rpc("purge_old_consent_events");
    if (error) {
      // Fonction absente (migration 0052 non appliquée) → on ignore en silence.
      if (!/function .*purge_old_consent_events.* does not exist/i.test(error.message)) {
        out.errors.push(`consent_purge: ${error.message}`);
      }
    } else if (typeof data === "number") {
      out.consentPurged = data;
    }
  } catch (e: any) {
    out.errors.push(`consent_purge: ${e?.message ?? "error"}`);
  }

  // Heartbeat : prouve au contrôle de santé que le cron a bien tourné
  await setSystemState("cron_daily_last_run", new Date().toISOString());

  // Remonte les erreurs éventuelles à Sentry (sans bloquer le cron)
  if (out.errors.length) {
    reportError(new Error(`cron/daily: ${out.errors.length} erreur(s)`), {
      where: "cron/daily",
      errors: out.errors,
    });
  }

  return Response.json({ ok: true, ...out });
}
