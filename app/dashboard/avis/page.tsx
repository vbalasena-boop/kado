import Link from "next/link";
import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { hardenExternalUrl } from "@/lib/wheel";
import AvisClient from "./AvisClient";

export const dynamic = "force-dynamic";

/** Motifs de signalement recevables par Google (mémo commerçant). */
const REPORT_REASONS: { emoji: string; label: string; detail: string }[] = [
  { emoji: "🚫", label: "Spam ou faux avis", detail: "avis d'un robot, d'un concurrent, ou de quelqu'un qui n'est jamais venu." },
  { emoji: "🤬", label: "Propos injurieux ou haineux", detail: "insultes, discrimination, harcèlement." },
  { emoji: "🎯", label: "Hors sujet", detail: "ne parle pas de votre établissement ni d'une vraie visite." },
  { emoji: "⚖️", label: "Conflit d'intérêt", detail: "ex-employé, concurrent, ou avis rédigé contre rémunération." },
  { emoji: "🔓", label: "Informations personnelles", detail: "nom d'un salarié, coordonnées, données privées." },
];

export default async function AvisPage() {
  const { business } = await getMyBusiness();
  if (!business) return null;

  // Lien d'avis Google (lecture tolérante ; durci anti-XSS).
  let reviewHref: string | null = null;
  try {
    const { data } = await getAdminClient()
      .from("wheel_configs")
      .select("review_url")
      .eq("business_id", business.id)
      .maybeSingle();
    reviewHref = hardenExternalUrl((data as any)?.review_url);
  } catch {
    reviewHref = null;
  }

  return (
    <>
      <h1 className="dash-h1">Gérer mes avis</h1>
      <p className="dash-sub">
        On ne peut pas supprimer un avis sincère — même négatif. Mais vous pouvez
        <b> répondre</b>, <b>signaler</b> les avis abusifs, et faire remonter
        votre note avec plus d'avis positifs récents.
      </p>

      {/* 1. Répondre / signaler sur Google */}
      <div className="dash-card">
        <h2>Répondre ou signaler sur Google</h2>
        {reviewHref ? (
          <>
            <p className="muted">
              Ouvrez votre fiche pour répondre publiquement à un avis ou le
              signaler (bouton <b>⋮ → Signaler</b> sous l'avis).
            </p>
            <a
              className="btn"
              href={reviewHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              ⭐ Ouvrir ma fiche Google
            </a>
          </>
        ) : (
          <p className="muted">
            Renseignez d'abord votre <b>lien d'avis Google</b> dans{" "}
            <Link href="/dashboard/wheel">« Mon jeu »</Link> pour accéder ici en
            un clic à votre fiche.
          </p>
        )}
      </div>

      {/* 2. Mémo : quels avis sont signalables */}
      <div className="dash-card">
        <h2>Quels avis Google peut retirer ?</h2>
        <p className="muted">
          Google ne retire un avis que s'il <b>enfreint ses règles</b>. Un avis
          simplement négatif mais honnête ne sera pas supprimé. Motifs
          recevables :
        </p>
        <ul className="avis-reasons">
          {REPORT_REASONS.map((r) => (
            <li key={r.label}>
              <span className="avis-reason-emoji">{r.emoji}</span>
              <span>
                <b>{r.label}</b> — {r.detail}
              </span>
            </li>
          ))}
        </ul>
        <p className="muted avis-warn">
          ⚠️ Méfiez-vous des services qui promettent de « supprimer » des avis ou
          d'en « acheter » : c'est contraire aux règles de Google et cela peut
          pénaliser votre fiche.
        </p>
      </div>

      {/* 3. Assistant de réponse */}
      <AvisClient shopName={business.name} />
    </>
  );
}
