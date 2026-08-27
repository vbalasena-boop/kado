"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "📊 Tableau de bord" },
  { href: "/admin/prospection", label: "📣 Prospection" },
  { href: "/admin/prospection/instagram", label: "📸 File Instagram" },
  { href: "/admin/vendeurs", label: "🧑‍💼 Vendeurs" },
];

/** L'onglet est actif si son chemin est le PLUS SPÉCIFIQUE qui préfixe la page. */
function isActive(href: string, path: string): boolean {
  if (href === "/admin") return path === "/admin";
  return path === href || path.startsWith(href + "/");
}

export default function AdminNav() {
  const path = usePathname() || "/admin";
  const activeHref = LINKS.filter((l) => isActive(l.href, path)).sort(
    (a, b) => b.href.length - a.href.length
  )[0]?.href;

  return (
    <nav className="admin-nav" aria-label="Navigation administration">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`admin-nav-link${l.href === activeHref ? " on" : ""}`}
          aria-current={l.href === activeHref ? "page" : undefined}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
