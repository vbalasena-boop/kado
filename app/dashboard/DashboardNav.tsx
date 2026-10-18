"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";

type Props = {
  showRoue: boolean;
  showFidelite: boolean;
  clickCollect: boolean;
  slug: string;
};

export default function DashboardNav({
  showRoue,
  showFidelite,
  clickCollect,
  slug,
}: Props) {
  const pathname = usePathname();
  const secondaryPaths = [
    "/dashboard/leads",
    "/dashboard/campaigns",
    "/dashboard/avis",
    "/dashboard/feedback",
    "/dashboard/billing",
    "/dashboard/aide",
  ];
  const moreIsCurrent =
    secondaryPaths.some((path) => pathname?.startsWith(path)) ||
    (showRoue && (pathname === `/${slug}` || pathname === `/${slug}/`)) ||
    (showFidelite && pathname === `/${slug}/fidelite`);

  return (
    <nav className="dash-nav" aria-label="Navigation de l’espace commerçant">
      <div className="dash-nav-primary">
        <Link href="/dashboard" aria-current={pathname === "/dashboard" ? "page" : undefined}>
          <Icon name="dashboard" /> Vue d’ensemble
        </Link>
        {showRoue && (
          <Link href="/dashboard/wheel" aria-current={pathname === "/dashboard/wheel" ? "page" : undefined}>
            <Icon name="wheel" /> Mon jeu
          </Link>
        )}
        {showFidelite && !showRoue && (
          <Link href="/dashboard/wheel" aria-current={pathname === "/dashboard/wheel" ? "page" : undefined}>
            <Icon name="wheel" /> Fidélité
          </Link>
        )}
        {showRoue && (
          <Link href="/dashboard/qr" aria-current={pathname === "/dashboard/qr" ? "page" : undefined}>
            <Icon name="qr" /> QR code
          </Link>
        )}
        <Link href="/dashboard/validate" aria-current={pathname === "/dashboard/validate" ? "page" : undefined}>
          <Icon name="redeem" /> Valider en caisse
        </Link>
        {clickCollect && (
          <Link href="/dashboard/orders" aria-current={pathname === "/dashboard/orders" ? "page" : undefined}>
            <Icon name="cart" /> Commandes
          </Link>
        )}
      </div>

      <details className="dash-nav-more" open={moreIsCurrent || undefined}>
        <summary aria-label="Afficher les autres outils">
          <span className="dash-nav-more-dots" aria-hidden="true">•••</span>
          <span>Autres outils</span>
          <span className="dash-nav-chevron" aria-hidden="true">⌄</span>
        </summary>
        <div className="dash-nav-secondary">
          {showRoue && (
            <Link href="/dashboard/leads" aria-current={pathname?.startsWith("/dashboard/leads") ? "page" : undefined}>
              <Icon name="mail" /> Clients
            </Link>
          )}
          <Link href="/dashboard/campaigns" aria-current={pathname?.startsWith("/dashboard/campaigns") ? "page" : undefined}>
            <Icon name="share" /> Campagnes
          </Link>
          <Link href="/dashboard/avis" aria-current={pathname?.startsWith("/dashboard/avis") ? "page" : undefined}>
            <Icon name="star" /> Avis Google
          </Link>
          <Link href="/dashboard/feedback" aria-current={pathname?.startsWith("/dashboard/feedback") ? "page" : undefined}>
            <Icon name="mail" /> Retours
          </Link>
          <Link href="/dashboard/billing" aria-current={pathname?.startsWith("/dashboard/billing") ? "page" : undefined}>
            <Icon name="card" /> Abonnement
          </Link>
          <Link href="/dashboard/aide" aria-current={pathname?.startsWith("/dashboard/aide") ? "page" : undefined}>
            <Icon name="help" /> Aide
          </Link>
          {showRoue && (
            <>
              <Link href={`/${slug}?preview=1`} target="_blank">
                <Icon name="test" /> Tester mon jeu
              </Link>
              <Link href={`/${slug}`} target="_blank">
                <Icon name="external" /> Voir ma page
              </Link>
            </>
          )}
          {showFidelite && (
            <Link href={`/${slug}/fidelite`} target="_blank">
              <Icon name="loyalty" /> Carte fidélité
            </Link>
          )}
        </div>
      </details>
    </nav>
  );
}
