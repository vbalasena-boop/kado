import QRCode from "qrcode";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * Encart de parrainage commerçant du dashboard (boucle produit ↔ parrainage).
 * Affiche le lien + QR de parrainage de l'hôte et un suivi DÉRIVÉ en lecture
 * (nb de filleuls, mois offerts gagnés) — aucun compteur dénormalisé.
 */
export default async function ReferralPanel({
  businessId,
  slug,
}: {
  businessId: string;
  slug: string;
}) {
  const admin = getAdminClient();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  const link = `${siteUrl}/tarifs?parrain=${encodeURIComponent(slug)}`;

  // Suivi dérivé directement des données (AD-6).
  let filleuls = 0;
  let rewarded = 0;
  try {
    const [a, b] = await Promise.all([
      admin
        .from("businesses")
        .select("*", { count: "exact", head: true })
        .eq("referred_by", businessId),
      admin
        .from("businesses")
        .select("*", { count: "exact", head: true })
        .eq("referred_by", businessId)
        .not("referral_rewarded_at", "is", null),
    ]);
    filleuls = a.count ?? 0;
    rewarded = b.count ?? 0;
  } catch {
    /* colonnes absentes : on affiche 0, l'encart reste utile */
  }

  let qr = "";
  try {
    qr = await QRCode.toDataURL(link, {
      width: 220,
      margin: 1,
      color: { dark: "#1b1035", light: "#ffffff" },
    });
  } catch {
    /* pas de QR : le lien texte suffit */
  }

  return (
    <div className="dash-card">
      <h2 className="dash-section-title">
        🎁 Parrainez un commerçant → 1 mois offert
      </h2>
      <p className="dash-sub" style={{ marginTop: 0 }}>
        Un commerçant s'inscrit via votre lien (ou votre roue) ? Dès son
        <b> premier paiement</b>, vous gagnez <b>1 mois offert</b>.
      </p>

      <div
        style={{
          display: "flex",
          gap: 20,
          flexWrap: "wrap",
          alignItems: "center",
          marginTop: 12,
        }}
      >
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element -- data URI (QR généré)
          <img
            src={qr}
            alt="QR de votre lien de parrainage"
            width={132}
            height={132}
            style={{ borderRadius: 12, border: "1px solid #eee", flex: "none" }}
          />
        )}
        <div style={{ minWidth: 220, flex: 1 }}>
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: ".04em",
              textTransform: "uppercase",
              opacity: 0.6,
              marginBottom: 6,
            }}
          >
            Votre lien de parrainage
          </label>
          <code
            style={{
              display: "block",
              wordBreak: "break-all",
              background: "#f4f0ff",
              color: "#1b1035",
              padding: "10px 12px",
              borderRadius: 10,
              fontSize: 13,
            }}
          >
            {link}
          </code>

          <div style={{ display: "flex", gap: 16, marginTop: 14 }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>
                {filleuls}
              </div>
              <div style={{ fontSize: 12, opacity: 0.65 }}>
                commerçant{filleuls > 1 ? "s" : ""} parrainé
                {filleuls > 1 ? "s" : ""}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>
                {rewarded}
              </div>
              <div style={{ fontSize: 12, opacity: 0.65 }}>
                mois offert{rewarded > 1 ? "s" : ""} gagné
                {rewarded > 1 ? "s" : ""}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
