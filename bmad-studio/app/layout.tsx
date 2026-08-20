import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BMAD Studio — de l'idée à la roadmap",
  description:
    "Décris ton idée, la méthode BMAD (propulsée par Claude) produit une analyse de faisabilité complète, un PRD, une architecture et une roadmap.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
