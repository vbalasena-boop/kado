import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://kado-app.fr"),
  title: {
    default: "Kado — Plus d'avis Google & d'abonnés Instagram pour votre commerce",
    template: "%s — Kado",
  },
  description:
    "Kado est le jeu de roue de la fortune qui transforme vos clients en avis Google 5★ et en abonnés Instagram. Sans application, installé en 2 minutes. Essai gratuit 14 jours.",
  keywords: [
    "avis Google",
    "abonnés Instagram",
    "roue de la fortune",
    "fidélisation commerce",
    "QR code restaurant",
    "marketing local",
    "e-réputation",
  ],
  applicationName: "Kado",
  authors: [{ name: "Kado" }],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Kado — Plus d'avis Google & d'abonnés Instagram",
    description:
      "Le jeu de roue qui transforme vos clients en avis 5★ et en abonnés — sans application, à chaque visite. Essai gratuit 14 jours.",
    url: "https://kado-app.fr",
    siteName: "Kado",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kado — Plus d'avis Google & d'abonnés Instagram",
    description:
      "Le jeu de roue qui transforme vos clients en avis 5★ et en abonnés — sans application. Essai gratuit 14 jours.",
  },
  robots: { index: true, follow: true },
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
    <html lang="fr" className={`${display.variable} ${sans.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
