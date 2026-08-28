import Link from "next/link";
import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Feedback = {
  id: string;
  message: string;
  email: string | null;
  created_at: string;
};

export default async function FeedbackPage() {
  const { business } = await getMyBusiness();
  if (!business) return null;

  // Retours privés du commerce (scoping business_id ; tolérant si 0071 absente).
  let rows: Feedback[] = [];
  try {
    const { data } = await getAdminClient()
      .from("feedback")
      .select("id, message, email, created_at")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(200);
    rows = (data as Feedback[]) ?? [];
  } catch {
    rows = [];
  }

  return (
    <>
      <h1 className="dash-h1">Retours privés</h1>
      <p className="dash-sub">
        Les messages que vos clients vous laissent en privé (avant de penser à
        un avis public). Recontactez-les pour régler le souci — c'est le
        meilleur moyen d'éviter un mauvais avis Google.
      </p>

      {rows.length === 0 ? (
        <div className="dash-card">
          <p className="muted">
            Aucun retour pour l'instant. Activez « 💬 Recueillir les avis privés »
            dans <Link href="/dashboard/wheel">« Mon jeu »</Link> pour proposer
            le formulaire à vos clients.
          </p>
        </div>
      ) : (
        <div className="feedback-list">
          {rows.map((f) => (
            <div className="dash-card feedback-item" key={f.id}>
              <div className="feedback-meta">
                {new Date(f.created_at).toLocaleString("fr-FR")}
                {f.email && (
                  <>
                    {" · "}
                    <a href={`mailto:${f.email}`}>{f.email}</a>
                  </>
                )}
              </div>
              <p className="feedback-msg">{f.message}</p>
              {f.email && (
                <a className="btn-secondary" href={`mailto:${f.email}`}>
                  ✉️ Répondre
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
