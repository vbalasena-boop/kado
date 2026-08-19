import { getSessionUser } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { getAffiliateStats } from "@/lib/affiliates";
import StatsView, { VendorStatsData } from "./[key]/StatsView";
import JoinForm from "./JoinForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  title: "Devenir promoteur — Kado",
  description:
    "Recommandez Kado aux commerçants autour de vous et touchez une commission à chaque abonnement signé.",
};

/** Présentation du programme + parcours d'inscription. */
function Pitch({ loggedIn }: { loggedIn: boolean }) {
  return (
    <div className="dash">
      <header className="dash-top">
        <div className="dash-brand">🎡 Kado · Programme promoteur</div>
      </header>
      <main className="dash-main">
        <h1 className="dash-h1">🤝 Devenez promoteur Kado</h1>
        <p className="dash-sub">
          Vous connaissez des commerçants ? Recommandez-leur Kado avec votre
          lien personnel et touchez une commission à chaque abonnement signé.
          Sans quota, sans engagement.
        </p>

        <div className="dash-card">
          <h2>Comment ça marche</h2>
          <p>
            1️⃣ Créez votre profil — vous recevez votre lien personnel.
            <br />
            2️⃣ Partagez-le aux commerçants (WhatsApp, e-mail, en main
            propre…).
            <br />
            3️⃣ Un commerce s'inscrit via votre lien puis s'abonne : votre
            commission est validée automatiquement.
            <br />
            4️⃣ Vous êtes payé par virement après le 2ᵉ prélèvement de votre
            client, sur simple facture.
          </p>
        </div>

        <div className="dash-card">
          <h2>💶 Vos commissions</h2>
          <p>
            Fidélité (19 €/mois) → <b>20 €</b> · Jeux (29 €/mois) →{" "}
            <b>30 €</b> · Complet (44 €/mois) → <b>45 €</b> par client signé.
          </p>
          <p className="muted">
            Exemple : 10 commerces signés en Complet = 450 €. Suivi en temps
            réel dans votre espace, e-mail automatique à chaque commission.
          </p>
        </div>

        <div className="dash-card">
          {loggedIn ? (
            <>
              <h2>🚀 Créer mon profil promoteur</h2>
              <JoinForm />
            </>
          ) : (
            <>
              <h2>🚀 Rejoindre le programme</h2>
              <p>
                Créez votre compte (ou connectez-vous) — un simple code reçu
                par e-mail, sans mot de passe :
              </p>
              <p>
                <a className="btn" href="/login?signup=1&next=/vendeur">
                  Créer mon compte promoteur
                </a>{" "}
                <a className="btn ghost" href="/login?next=/vendeur">
                  J'ai déjà un compte
                </a>
              </p>
            </>
          )}
          <p className="muted">
            En rejoignant le programme, vous exercez en indépendant (statut
            requis pour facturer, ex. micro-entrepreneur). Un contrat
            d'apporteur d'affaires vous sera envoyé.
          </p>
        </div>
      </main>
    </div>
  );
}

export default async function VendeurHome() {
  // Page publique : ne doit jamais planter, même sans configuration auth.
  let user: Awaited<ReturnType<typeof getSessionUser>> = null;
  try {
    user = await getSessionUser();
  } catch {
    user = null;
  }
  if (!user) return <Pitch loggedIn={false} />;

  let db;
  try {
    db = getAdminClient();
  } catch {
    return <Pitch loggedIn={false} />;
  }

  // Profil promoteur du compte connecté (tolérant si migration absente)
  let aff: any = null;
  try {
    const { data } = await db
      .from("affiliates")
      .select(
        "id, name, code, active, commission_roue_cents, commission_fidelite_cents, commission_complet_cents"
      )
      .eq("owner_user_id", user.id)
      .maybeSingle();
    aff = data;
  } catch {
    aff = null;
  }

  if (!aff) return <Pitch loggedIn />;
  if (!aff.active) {
    return (
      <main className="landing">
        <div className="landing-card">
          <div className="landing-logo">🤝</div>
          <h1>Profil désactivé</h1>
          <p>
            Votre profil promoteur est désactivé. Contactez Kado pour le
            réactiver.
          </p>
        </div>
      </main>
    );
  }

  const stats = await getAffiliateStats(db, aff.id);
  const data: VendorStatsData = {
    name: aff.name,
    code: aff.code,
    commissionRoue: aff.commission_roue_cents / 100,
    commissionFidelite: aff.commission_fidelite_cents / 100,
    commissionComplet: aff.commission_complet_cents / 100,
    ...stats,
  };
  return <StatsView data={data} />;
}
