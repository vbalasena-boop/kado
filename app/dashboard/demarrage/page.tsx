import { headers } from "next/headers";
import QRCode from "qrcode";
import { getMyBusiness } from "@/lib/auth";
import { StartGuide } from "@/components/StartGuide";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function DemarragePage() {
  const { business } = await getMyBusiness();
  if (!business) return null;

  const h = headers();
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? "localhost:3000"}`;
  const url = `${base.replace(/\/$/, "")}/${business.slug}`;

  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 600,
    margin: 1,
    color: { dark: "#1b1330", light: "#ffffff" },
  });

  const today = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <h1 className="dash-h1">Guide de démarrage</h1>
      <p className="dash-sub">
        Votre guide personnalisé, prêt à imprimer. Gardez-le près de la caisse
        ou partagez-le avec votre équipe pour prendre le bon réflexe.
      </p>

      <div className="poster-actions">
        <h2 className="dash-h2">Votre guide</h2>
        <PrintButton label="🖨️ Imprimer / Enregistrer en PDF" />
      </div>

      <div className="poster-stage">
        <StartGuide
          name={business.name}
          url={url}
          qrDataUrl={qrDataUrl}
          logoUrl={business.logo_url}
          today={today}
        />
      </div>
    </>
  );
}
