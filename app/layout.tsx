import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SpinReview — Roue de récompense",
  description:
    "Scannez, jouez, gagnez : plus d'avis Google et d'abonnés Instagram pour votre commerce.",
};

export const viewport: Viewport = {
  themeColor: "#1b1035",
  width: "device-width",
  initialScale: 1,
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
