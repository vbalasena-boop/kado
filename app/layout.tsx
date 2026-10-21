import type { Metadata, Viewport } from "next";
import {
  Bricolage_Grotesque,
  Plus_Jakarta_Sans,
  Playfair_Display,
  JetBrains_Mono,
} from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import RefCapture from "@/components/RefCapture";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Serif éditoriale en ACCENT (mots mis en avant dans les titres) : signature
// « premium » transposée à la marque Kado. Playfair Display (display serif à
// fort contraste), retenue à la place d'Instrument Serif pour éviter le
// « tell » IA le plus courant tout en gardant l'italique éditoriale.
const serif = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

// Mono pour les eyebrows / labels (uppercase, tracking large).
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://kado-app.fr"),
  title: {
    default: "Kado : un petit jeu et une carte de fidélité",
    template: "%s | Kado",
  },
  description:
    "Kado aide les commerces de proximité à fidéliser leurs clients avec des jeux, une carte digitale et un bipeur. Essai gratuit 14 jours, sans carte bancaire.",
  keywords: [
    "carte de fidélité digitale",
    "jeu client commerce",
    "fidélisation commerce",
    "bipeur restaurant",
    "QR code restaurant",
    "marketing local",
    "e-réputation",
  ],
  applicationName: "Kado",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "Kado",
    statusBarStyle: "black-translucent",
  },
  other: { "mobile-web-app-capable": "yes" },
  authors: [{ name: "Kado" }],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Kado | Un petit jeu. Une vraie raison de revenir.",
    description:
      "Un petit jeu et une carte de fidélité qui donnent à vos clients une vraie raison de revenir, sans application. Essai gratuit 14 jours.",
    url: "https://kado-app.fr",
    siteName: "Kado",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kado | Un petit jeu. Une vraie raison de revenir.",
    description:
      "Un petit jeu et une carte de fidélité qui donnent à vos clients une vraie raison de revenir, sans application. Essai gratuit 14 jours.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#130a20",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${display.variable} ${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body>
        <a className="skip-link" href="#main-content">
          Aller au contenu principal
        </a>
        {/* Sécurité SANS JS : si le JavaScript ne tourne pas, les blocs à
            révélation restent visibles (l'animation `initial:opacity 0` de
            Framer Motion ne serait sinon jamais annulée). N'affecte rien
            quand le JS est actif. */}
        <noscript>
          <style>{`[data-reveal],.v-hero-inner,.v-hero-inner>*{opacity:1!important;transform:none!important;filter:none!important}.v-film{height:auto!important}.v-film-stage{position:static!important;height:auto!important;overflow:visible!important}.v-film-scene{position:static!important;opacity:1!important;transform:none!important;pointer-events:auto!important;padding:24px 16px!important}.v-film-bar,.v-film-bg{display:none!important}`}</style>
        </noscript>
        <RefCapture />
        {children}
        {process.env.VERCEL === "1" && <Analytics />}
      </body>
    </html>
  );
}
