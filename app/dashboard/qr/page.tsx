import { headers } from "next/headers";
import QRCode from "qrcode";
import { getMyBusiness } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function QrPage() {
  const { business } = await getMyBusiness();
  if (!business) return null;

  const h = headers();
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? "localhost:3000"}`;
  const url = `${base.replace(/\/$/, "")}/${business.slug}`;

  const dataUrl = await QRCode.toDataURL(url, {
    width: 900,
    margin: 2,
    color: { dark: "#1b1035", light: "#ffffff" },
  });

  return (
    <>
      <h1 className="dash-h1">QR code</h1>
      <p className="dash-sub">
        Imprimez ce QR sur vos tables, tickets ou stickers. Un scan ouvre votre
        page de jeu.
      </p>

      <div className="dash-card qr-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUrl} alt="QR code de ma page de jeu" className="qr-img" />
        <div className="qr-url">{url}</div>
        <a className="btn" href={dataUrl} download={`qr-${business.slug}.png`}>
          Télécharger le QR (PNG)
        </a>
      </div>
    </>
  );
}
