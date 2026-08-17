import { NextRequest } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getAdminClient } from "@/lib/supabase/admin";
import { sendEmail, emailLayout, getOwnerContact } from "@/lib/email";

/** Retrouve l'établissement lié à une facture (via metadata ou customer). */
async function resolveBusinessId(
  stripe: Stripe,
  invoice: Stripe.Invoice
): Promise<string | null> {
  const subId = (invoice as any).subscription as string | null;
  if (subId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subId);
      if (sub.metadata?.business_id) return sub.metadata.business_id;
    } catch {
      /* ignore */
    }
  }
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  if (customerId) {
    const { data } = await getAdminClient()
      .from("businesses")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    return data?.id ?? null;
  }
  return null;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Applique l'état d'un abonnement Stripe à l'établissement correspondant. */
async function applySubscription(sub: Stripe.Subscription) {
  const db = getAdminClient();
  const businessId = sub.metadata?.business_id;
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const active = sub.status === "active" || sub.status === "trialing";
  const endsAt = (sub as any).current_period_end
    ? new Date((sub as any).current_period_end * 1000).toISOString()
    : null;

  const plan = sub.metadata?.plan;
  const patch: Record<string, unknown> = {
    stripe_subscription_id: sub.id,
    subscription_status: active ? "active" : "suspended",
    status: active ? "active" : "suspended",
    subscription_ends_at: endsAt,
  };
  if (plan && ["roue", "fidelite", "complet"].includes(plan)) {
    patch.plan = plan;
  }
  // Abonnement résilié : l'option Campagnes (article payant) disparaît avec
  // lui — on la coupe aussi en base pour éviter un accès gratuit après
  // un futur réabonnement.
  if (sub.status === "canceled") {
    patch.campaigns_addon = false;
  }

  const query = db.from("businesses").update(patch);
  if (businessId) await query.eq("id", businessId);
  else await query.eq("stripe_customer_id", customerId);
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ error: "no_webhook_secret" }, { status: 500 });
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) return Response.json({ error: "no_signature" }, { status: 400 });

  const stripe = getStripe();
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch {
    return Response.json({ error: "bad_signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          if (session.metadata?.business_id && !sub.metadata?.business_id) {
            sub.metadata = { business_id: session.metadata.business_id };
          }
          await applySubscription(sub);
        }

        // Parrainage commerçant : 1 mois offert au parrain quand le
        // filleul règle son premier abonnement (une seule fois).
        try {
          const refBizId = session.metadata?.business_id;
          if (refBizId && session.subscription) {
            const db = getAdminClient();
            const { data: refBiz } = await db
              .from("businesses")
              .select("id, name, referred_by, referral_rewarded_at")
              .eq("id", refBizId)
              .maybeSingle();
            if (refBiz?.referred_by && !refBiz.referral_rewarded_at) {
              const { data: sponsor } = await db
                .from("businesses")
                .select("id, name, stripe_subscription_id, subscription_ends_at")
                .eq("id", refBiz.referred_by)
                .maybeSingle();
              if (sponsor) {
                // marque la récompense AVANT de l'accorder (anti-doublon)
                await db
                  .from("businesses")
                  .update({ referral_rewarded_at: new Date().toISOString() })
                  .eq("id", refBiz.id);

                let granted = false;
                if (sponsor.stripe_subscription_id) {
                  // parrain abonné : 100 % de remise sur sa prochaine facture
                  try {
                    const coupon = await stripe.coupons.create({
                      percent_off: 100,
                      duration: "once",
                      name: "Parrainage Kado — 1 mois offert",
                    });
                    await stripe.subscriptions.update(
                      sponsor.stripe_subscription_id,
                      { coupon: coupon.id } as any
                    );
                    granted = true;
                  } catch {
                    /* repli ci-dessous */
                  }
                }
                if (!granted) {
                  // parrain en essai (ou échec Stripe) : +30 jours d'accès
                  const base = Math.max(
                    Date.now(),
                    sponsor.subscription_ends_at
                      ? new Date(sponsor.subscription_ends_at).getTime()
                      : 0
                  );
                  await db
                    .from("businesses")
                    .update({
                      subscription_ends_at: new Date(
                        base + 30 * 864e5
                      ).toISOString(),
                      status: "active",
                    })
                    .eq("id", sponsor.id);
                }

                const { email: spEmail } = await getOwnerContact(
                  db,
                  sponsor.id
                );
                if (spEmail) {
                  await sendEmail({
                    to: spEmail,
                    subject: "1 mois offert — merci pour le parrainage ! 🎉",
                    html: emailLayout({
                      preview: "Votre filleul vient de s'abonner à Kado.",
                      heading: "1 mois offert ! 🎉",
                      emoji: "🤝",
                      bodyHtml: `Bonne nouvelle : <b>${
                        refBiz.name ?? "votre filleul"
                      }</b> vient de s'abonner à Kado et de régler son premier paiement grâce à vous.<br><br>Pour vous remercier, <b>votre prochain mois est offert</b>${
                        sponsor.stripe_subscription_id
                          ? " (remise de 100 % appliquée automatiquement sur votre prochaine facture)"
                          : " (30 jours d'accès ajoutés à votre compte)"
                      }.<br><br>Continuez à partager votre lien de parrainage : chaque nouveau commerçant abonné et payant = un mois offert !`,
                    }),
                  });
                }
              }
            }
          }
        } catch {
          /* le parrainage ne doit jamais bloquer le webhook */
        }

        // Option « Installation clé en main » achetée avec l'abonnement
        const setup = session.metadata?.setup;
        const businessId = session.metadata?.business_id;
        if ((setup === "remote" || setup === "onsite") && businessId) {
          const db = getAdminClient();
          await db
            .from("businesses")
            .update({
              setup_option: setup,
              setup_paid_at: new Date().toISOString(),
            })
            .eq("id", businessId);

          const label =
            setup === "onsite"
              ? "Installation sur place (129 €)"
              : "Installation à distance (79 €)";
          const { email, businessName } = await getOwnerContact(db, businessId);

          // Téléphone et adresse du commerçant (lecture tolérante)
          let phone: string | null = null;
          let address: string | null = null;
          try {
            const { data: p } = await db
              .from("businesses")
              .select("phone, address")
              .eq("id", businessId)
              .maybeSingle();
            phone = (p as any)?.phone ?? null;
            address = (p as any)?.address ?? null;
          } catch {
            /* ignore */
          }

          if (email) {
            await sendEmail({
              to: email,
              subject: "Votre installation clé en main est réservée",
              html: emailLayout({
                preview: "Nous configurons Kado pour vous.",
                heading: "Installation clé en main réservée !",
                emoji: "🛠️",
                bodyHtml: `Bonjour,<br><br>Merci pour votre confiance ! Votre option <b>${label}</b>${
                  businessName ? ` pour <b>${businessName}</b>` : ""
                } est bien enregistrée.<br><br>Nous vous contactons <b>sous 24&nbsp;h ouvrées</b> pour organiser la configuration complète de votre espace (roue, cadeaux, liens, affiche${
                  setup === "onsite" ? ", venue sur place et formation de l'équipe" : ""
                }). Vous n'avez rien à préparer.`,
                footnote: "Une question ? Répondez simplement à cet e-mail.",
              }),
            });
          }

          const adminEmail = (process.env.ADMIN_EMAILS || "")
            .split(",")[0]
            ?.trim();
          if (adminEmail) {
            await sendEmail({
              to: adminEmail,
              subject: `Nouvelle installation à réaliser — ${businessName ?? businessId}`,
              html: emailLayout({
                preview: "Un client a acheté l'installation clé en main.",
                heading: "Nouvelle installation vendue !",
                emoji: "🛠️",
                bodyHtml: `Client : <b>${businessName ?? businessId}</b><br>Option : <b>${label}</b><br>E-mail : <b>${
                  email ?? "introuvable"
                }</b><br>Téléphone : <b>${
                  phone ?? "non renseigné"
                }</b><br>Adresse : <b>${
                  address ?? "non renseignée"
                }</b><br><br>À contacter sous 24 h ouvrées.`,
              }),
            });
          }
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await applySubscription(event.data.object as Stripe.Subscription);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const businessId = await resolveBusinessId(stripe, invoice);
        if (businessId) {
          const db = getAdminClient();
          const { email, businessName } = await getOwnerContact(db, businessId);
          if (email) {
            const url =
              (invoice as any).hosted_invoice_url ||
              "https://kado-app.fr/dashboard/billing";
            await sendEmail({
              to: email,
              subject: "Paiement échoué — action requise",
              html: emailLayout({
                preview: "Votre dernier paiement Kado a échoué.",
                heading: "Votre paiement n'a pas abouti",
                emoji: "⚠️",
                bodyHtml: `Bonjour,<br><br>Le paiement de votre abonnement Kado${
                  businessName ? ` pour <b>${businessName}</b>` : ""
                } n'a pas pu être effectué. Pour éviter la coupure de votre jeu, merci de mettre à jour votre moyen de paiement.<br><br><a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#ff6b4a,#ff4e87);color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:12px;">Régler mon abonnement</a>`,
                footnote:
                  "Stripe retentera automatiquement le paiement dans les prochains jours.",
              }),
            });
          }
        }
        break;
      }
      default:
        break;
    }
  } catch {
    return Response.json({ error: "handler_error" }, { status: 500 });
  }

  return Response.json({ received: true });
}
