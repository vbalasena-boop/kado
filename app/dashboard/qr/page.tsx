import { headers } from "next/headers";
import QRCode from "qrcode";
import { getMyBusiness } from "@/lib/auth";
import { KadoMark } from "@/components/Logo";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

function IgGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5.4" fill="none" stroke="#1b1035" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="#1b1035" strokeWidth="2" />
      <circle cx="17.3" cy="6.7" r="1.3" fill="#1b1035" />
    </svg>
  );
}
function GGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  );
}

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
    margin: 1,
    color: { dark: "#1b1035", light: "#ffffff" },
  });

  return (
    <>
      <h1 className="dash-h1">QR code & affiche</h1>
      <p className="dash-sub">
        Téléchargez votre QR, ou imprimez l'affiche prête à poser sur vos tables,
        votre comptoir ou votre vitrine.
      </p>

      <div className="dash-card qr-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUrl} alt="QR code de ma page de jeu" className="qr-img" />
        <div className="qr-url">{url}</div>
        <a className="btn" href={dataUrl} download={`qr-${business.slug}.png`}>
          Télécharger le QR (PNG)
        </a>
      </div>

      <div className="poster-actions">
        <h2 className="dash-h2">Affiche à imprimer</h2>
        <PrintButton />
      </div>

      {/* Aperçu + version imprimable de l'affiche */}
      <div className="print-poster">
        <div className="pp-head">
          {business.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.logo_url} alt={business.name} className="pp-logo" />
          ) : (
            <div className="pp-logo pp-logo-ph">
              {(business.name || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="pp-name">{business.name}</div>
        </div>

        <div className="pp-title">Tentez votre chance&nbsp;! 🎁</div>
        <p className="pp-sub">
          Scannez, faites tourner la roue et repartez avec un cadeau.
        </p>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUrl} alt="QR code" className="pp-qr" />
        <div className="pp-scan">📷 Scannez avec l'appareil photo — aucune appli</div>

        <div className="pp-ways">
          <span className="pp-way"><IgGlyph /> Suivez-nous</span>
          <span className="pp-way"><GGlyph /> Laissez un avis</span>
        </div>

        <div className="pp-foot">
          <KadoMark size={20} />
          <span>Propulsé par <b>Kado</b></span>
        </div>
      </div>
    </>
  );
}
