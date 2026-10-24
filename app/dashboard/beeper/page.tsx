import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getMyBusiness } from "@/lib/auth";
import { beeperPilot } from "@/lib/beeper";
import BeeperBoard from "./BeeperBoard";
export default async function Page() {
  const { business } = await getMyBusiness();
  if (!business || !beeperPilot(business.slug)) notFound();
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || `${h.get("x-forwarded-proto") || "https"}://${h.get("host")}`;
  const url = `${origin}/b/${business.slug}`;
  const qr = await QRCode.toDataURL(url, { width: 300, margin: 2 });
  return <><h1 className="dash-h1">Beeper virtuel</h1><div className="dash-card"><h2>QR du comptoir</h2>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={qr} width={300} height={300} alt="QR à scanner pour obtenir un numéro de beeper" />
    <p><a href={url}>{url}</a></p><a className="btn-mini" href={qr} download="beeper-qr.png">Télécharger le QR</a>
  </div><BeeperBoard /></>;
}
