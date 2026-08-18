import { headers } from "next/headers";
import QRCode from "qrcode";
import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { KadoMark } from "@/components/Logo";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

// ---- Couleurs : helpers pour thématiser l'affiche ----
function toRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return [21, 12, 41];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lum(hex: string): number {
  const [r, g, b] = toRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
function mix(hex: string, target: string, amt: number): string {
  const a = toRgb(hex);
  const b = toRgb(target);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * amt));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}
function splitEmojis(s: string): string[] {
  const clean = (s || "").replace(/[\s,;·]+/g, "");
  if (!clean) return [];
  try {
    const seg = new (Intl as any).Segmenter("fr", { granularity: "grapheme" });
    return [...seg.segment(clean)].map((x: any) => x.segment).slice(0, 10);
  } catch {
    return Array.from(clean).slice(0, 10);
  }
}

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

function PosterWheel({
  segs,
  hub,
  rim,
  emojis,
}: {
  segs: string[];
  hub: string;
  rim: string;
  emojis: string[];
}) {
  const slots = [
    { x: 65, y: 27 },
    { x: 80, y: 53 },
    { x: 65, y: 79 },
    { x: 35, y: 79 },
    { x: 20, y: 53 },
    { x: 35, y: 27 },
  ];
  const fb = ["🎁", "☕", "🍰", "⭐", "🏷️", "🍹"];
  const glyphs = emojis.length ? emojis : fb;
  return (
    <svg viewBox="0 0 100 100" className="pp-wheel-svg" aria-hidden="true">
      <defs>
        <linearGradient id="pp-hub" x1="30" y1="30" x2="70" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor={mix(hub, "#ffffff", 0.35)} />
          <stop offset="1" stopColor={hub} />
        </linearGradient>
      </defs>
      <g stroke="#fff" strokeWidth="1.2" strokeLinejoin="round">
        <path d="M50 50 L50 6 A44 44 0 0 1 88.1 28 Z" fill={segs[0]} />
        <path d="M50 50 L88.1 28 A44 44 0 0 1 88.1 72 Z" fill={segs[1]} />
        <path d="M50 50 L88.1 72 A44 44 0 0 1 50 94 Z" fill={segs[2]} />
        <path d="M50 50 L50 94 A44 44 0 0 1 11.9 72 Z" fill={segs[3]} />
        <path d="M50 50 L11.9 72 A44 44 0 0 1 11.9 28 Z" fill={segs[4]} />
        <path d="M50 50 L11.9 28 A44 44 0 0 1 50 6 Z" fill={segs[5]} />
      </g>
      <g fontSize="9" textAnchor="middle">
        {slots.map((s, i) => (
          <text key={i} x={s.x} y={s.y}>
            {glyphs[i % glyphs.length]}
          </text>
        ))}
      </g>
      <ellipse cx="38" cy="32" rx="26" ry="17" fill="#fff" opacity="0.2" />
      <g fill="#fff">
        {[
          [94, 50], [88.1, 72], [72, 88.1], [50, 94], [28, 88.1], [11.9, 72],
          [6, 50], [11.9, 28], [28, 11.9], [50, 6], [72, 11.9], [88.1, 28],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="1.4" />
        ))}
      </g>
      <circle cx="50" cy="50" r="44" fill="none" stroke={rim} strokeWidth="3" />
      <circle cx="50" cy="50" r="12.5" fill="url(#pp-hub)" stroke="#1b1035" strokeWidth="3" />
      <circle cx="46" cy="46" r="3.2" fill="#fff" opacity="0.55" />
      <path d="M50 17 L44 4 L56 4 Z" fill="url(#pp-hub)" stroke="#1b1035" strokeWidth="1" />
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

  // ---- Couleurs & décor du commerçant (affiche sur-mesure) ----
  let primary = "#ffc24d";
  let accent = "#ff5d73";
  let bgColor = "#150c29";
  let decor = "";
  try {
    const admin = getAdminClient();
    const { data: cfg } = await admin
      .from("wheel_configs")
      .select("primary_color, accent_color, bg_color")
      .eq("business_id", business.id)
      .maybeSingle();
    if (cfg) {
      primary = (cfg as any).primary_color || primary;
      accent = (cfg as any).accent_color || accent;
      bgColor = (cfg as any).bg_color || bgColor;
    }
    const { data: d } = await admin
      .from("wheel_configs")
      .select("decor_emojis")
      .eq("business_id", business.id)
      .maybeSingle();
    decor = (d as any)?.decor_emojis || "";
  } catch {
    /* colonnes absentes : valeurs par défaut */
  }

  const bgLight = lum(bgColor) > 0.55;
  // Fond d'affiche : clair et imprimable dans tous les cas, teinté à la marque
  const posterBg = bgLight ? mix(bgColor, "#ffffff", 0.35) : "#fffdf8";
  const ink = "#1b1035";
  const rim = mix(primary, "#000000", 0.12);
  const gold = "#f0a52e";
  // 6 quartiers alternant les 2 couleurs de marque + une touche dorée
  const segs = [primary, accent, gold, mix(primary, "#ffffff", 0.18), accent, gold];
  // QR aux couleurs de marque si la couleur reste bien lisible, sinon encre
  const qrDark = lum(primary) < 0.45 ? primary : ink;
  const decorEmojis = splitEmojis(decor);

  const dataUrl = await QRCode.toDataURL(url, {
    width: 900,
    margin: 1,
    color: { dark: qrDark, light: "#ffffff" },
  });

  const posterStyle = {
    "--pp-bg": posterBg,
    "--pp-ink": ink,
    "--pp-primary": primary,
    "--pp-accent": accent,
    "--pp-rim": rim,
  } as React.CSSProperties;

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
      <div className="print-poster" style={posterStyle}>
        {decorEmojis.length > 0 && (
          <div className="pp-decor" aria-hidden="true">
            {[
              { t: "6%", l: "7%", r: -14 },
              { t: "9%", l: "84%", r: 12 },
              { t: "46%", l: "3%", r: -8 },
              { t: "50%", l: "90%", r: 10 },
              { t: "88%", l: "9%", r: 8 },
              { t: "90%", l: "82%", r: -12 },
            ].map((p, i) => (
              <span
                key={i}
                style={{ top: p.t, left: p.l, transform: `rotate(${p.r}deg)` }}
              >
                {decorEmojis[i % decorEmojis.length]}
              </span>
            ))}
          </div>
        )}
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

        <div className="pp-wheel">
          <PosterWheel segs={segs} hub={primary} rim={rim} emojis={decorEmojis} />
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
