"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { GAME_THEMES, matchTheme } from "@/lib/themes";
import { EnableNotifications } from "@/components/EnableNotifications";
import {
  isTriggerActionSelectable,
  resolveTriggerActions,
  nextTriggerActions,
} from "@/lib/wheel";

type Prize = {
  label: string;
  emoji: string;
  weight: number;
  color: string;
};
type Config = {
  primary_color: string;
  accent_color?: string | null;
  bg_color?: string | null;
  decor_emojis?: string | null;
  theme_locked?: boolean | null;
  instagram_url: string | null;
  review_url: string | null;
  compliance_note: string | null;
  daily_prize_limit?: number | null;
  one_prize_per_day?: boolean | null;
  prize_validity_days?: number | null;
  collect_email?: boolean | null;
  instagram_enabled?: boolean | null;
  review_enabled?: boolean | null;
  loyalty_enabled?: boolean | null;
  loyalty_goal?: number | null;
  loyalty_reward?: string | null;
  loyalty_reward_emoji?: string | null;
  loyalty_stamp_emoji?: string | null;
  game_type?: string | null;
  birthday_enabled?: boolean | null;
  birthday_reward?: string | null;
  referral_enabled?: boolean | null;
  reengage_almost?: boolean | null;
  reengage_inactive?: boolean | null;
  reengage_inactive_days?: number | null;
  reengage_reward?: boolean | null;
  review_invite?: boolean | null;
  convert_nudge?: boolean | null;
  feedback_enabled?: boolean | null;
  play_alerts?: boolean | null;
  monthly_draw?: boolean | null;
  monthly_draw_prize?: string | null;
  draw_period_days?: number | null;
  draw_next_at?: string | null;
  trigger_actions?: string[];
  // « À la une » : message éditable montré aux clients (jeu + fidélité).
  highlight_title?: string | null;
  highlight_text?: string | null;
  highlight_url?: string | null;
  highlight_until?: string | null;
};

// Actions déclenchantes (non-avis) proposées dans l'éditeur. L'avis Google
// n'y figure jamais (jamais une action récompensée — story 9.3).
const TRIGGER_ACTION_OPTIONS: { id: string; emoji: string; label: string; desc: string }[] = [
  { id: "instagram", emoji: "📸", label: "Instagram", desc: "Un suivi de votre compte débloque un tour." },
  { id: "loyalty", emoji: "🎟️", label: "Fidélité", desc: "S'inscrire à la carte de fidélité débloque un tour." },
  { id: "optin", emoji: "✉️", label: "Offres", desc: "Accepter de recevoir vos offres débloque un tour." },
];

// Luminance d'une couleur hex (0 = noir, 1 = blanc) pour choisir un texte lisible.
function hexLum(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
// Découpe une chaîne d'emojis en graphèmes (max 8) pour l'aperçu.
function splitDecor(s: string): string[] {
  const clean = (s || "").replace(/[\s,;·]+/g, "");
  if (!clean) return [];
  try {
    const seg = new (Intl as any).Segmenter("fr", { granularity: "grapheme" });
    return [...seg.segment(clean)].map((x: any) => x.segment).slice(0, 8);
  } catch {
    return Array.from(clean).slice(0, 8);
  }
}

const GAME_TYPES = [
  { id: "wheel", emoji: "🎡", label: "Roue de la fortune", desc: "Le grand classique, effet garanti" },
  { id: "scratch", emoji: "🎫", label: "Carte à gratter", desc: "On gratte avec le doigt, suspense !" },
  { id: "slot", emoji: "🎰", label: "Machine à sous", desc: "Trois rouleaux, ambiance casino" },
];

const FONT =
  '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
const SWATCHES = [
  "#ff5d73",
  "#8b6cff",
  "#39d98a",
  "#4fc3f7",
  "#ffc24d",
  "#ff8a5c",
  "#5a4a86",
  "#f06292",
];

const STAMP_EMOJIS = [
  "⭐", "☕", "🍕", "🍔", "🥐", "🧁", "🍰", "🍦",
  "🍷", "🍺", "🍸", "💇", "💅", "🌸", "❤️", "🔥",
  "✨", "🎯", "🏆", "👍",
];
const REWARD_EMOJIS = [
  "🎁", "☕", "🍰", "🍕", "🍔", "🍦", "🥐", "🍷",
  "🍺", "💐", "💇", "💅", "🎟️", "💶", "🏆", "❤️",
];

export default function WheelEditor({
  initialConfig,
  initialPrizes,
  initialLogoUrl,
  initialBgUrl,
  showRoue = true,
  showFidelite = true,
  plan = "roue",
}: {
  initialConfig: Config;
  initialPrizes: Prize[];
  initialLogoUrl?: string | null;
  initialBgUrl?: string | null;
  showRoue?: boolean;
  showFidelite?: boolean;
  plan?: string;
}) {
  // La section fidélité est verrouillée si la formule ne l'inclut pas.
  const fideliteLocked = !showFidelite;
  // Onglets de l'éditeur (uniquement pour la roue/jeux, pour éviter un long
  // défilement et rendre la configuration plus claire).
  type EditorTab = "look" | "game" | "links" | "fid" | "draw";
  const [tab, setTab] = useState<EditorTab>("look");
  const ALL_TABS: { id: EditorTab; label: string; show: boolean }[] = [
    { id: "look", label: "🎨 Apparence", show: showRoue },
    { id: "game", label: "🎮 Le jeu", show: showRoue },
    { id: "links", label: "🔗 Liens", show: showRoue },
    { id: "fid", label: "🎟️ Fidélité", show: showFidelite || showRoue },
    { id: "draw", label: "🎲 Tirage", show: showRoue },
  ];
  const TABS = ALL_TABS.filter((t) => t.show);
  // Page personnalisée par l'admin (formule Installation) : le commerçant
  // ne peut plus changer l'apparence lui-même.
  const themeLocked = !!initialConfig.theme_locked;
  const [config, setConfig] = useState<Config>(initialConfig);
  const [prizes, setPrizes] = useState<Prize[]>(
    initialPrizes.length
      ? initialPrizes
      : [{ label: "Café offert", emoji: "☕", weight: 20, color: "#ff5d73" }]
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isErr, setIsErr] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl ?? null);
  const [bgUrl, setBgUrl] = useState<string | null>(initialBgUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/dashboard/logo", {
        method: "POST",
        body: fd,
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.logo_url) {
        setLogoUrl(d.logo_url);
        setMsg("Logo mis à jour !");
      } else {
        setMsg("Échec de l'envoi du logo.");
      }
    } catch {
      setMsg("Connexion impossible.");
    } finally {
      setUploading(false);
    }
  }

  async function uploadBackground(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBg(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/dashboard/background", {
        method: "POST",
        body: fd,
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.bg_image_url) {
        setBgUrl(d.bg_image_url);
        setMsg("Image de fond mise à jour !");
      } else {
        setMsg("Échec de l'envoi de l'image.");
      }
    } catch {
      setMsg("Connexion impossible.");
    } finally {
      setUploadingBg(false);
    }
  }

  async function removeBackground() {
    setUploadingBg(true);
    try {
      await fetch("/api/dashboard/background", { method: "DELETE" });
      setBgUrl(null);
      setMsg("Image de fond retirée.");
    } finally {
      setUploadingBg(false);
    }
  }

  useEffect(() => {
    if (!showRoue) return;
    const cv = canvasRef.current;
    if (!cv || prizes.length === 0) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const R = cv.width / 2;
    const seg = (Math.PI * 2) / prizes.length;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.save();
    ctx.translate(R, R);
    ctx.rotate(-Math.PI / 2);
    prizes.forEach((p, i) => {
      const a0 = i * seg;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R - 4, a0, a0 + seg);
      ctx.closePath();
      ctx.fillStyle = p.color || "#ff5d73";
      ctx.fill();
      ctx.strokeStyle = "rgba(21,12,41,.55)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.save();
      ctx.rotate(a0 + seg / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#150c29";
      ctx.font = `700 24px ${FONT}`;
      ctx.fillText(p.emoji || "🎁", R - 22, 8);
      ctx.restore();
    });
    for (let i = 0; i < prizes.length; i++) {
      const a = i * seg;
      const x = Math.cos(a) * (R - 12);
      const y = Math.sin(a) * (R - 12);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,248,230,0.92)";
      ctx.fill();
    }
    ctx.restore();
    const gloss = ctx.createRadialGradient(R, R * 0.72, R * 0.1, R, R, R);
    gloss.addColorStop(0, "rgba(255,255,255,0.18)");
    gloss.addColorStop(0.55, "rgba(255,255,255,0.04)");
    gloss.addColorStop(1, "rgba(0,0,0,0.16)");
    ctx.beginPath();
    ctx.arc(R, R, R - 4, 0, Math.PI * 2);
    ctx.fillStyle = gloss;
    ctx.fill();
  }, [prizes, showRoue]);

  function update(i: number, patch: Partial<Prize>) {
    setPrizes((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }
  function addPrize() {
    setPrizes((ps) => [
      ...ps,
      { label: "Nouveau lot", emoji: "🎁", weight: 10, color: SWATCHES[ps.length % SWATCHES.length] },
    ]);
  }
  function removePrize(i: number) {
    setPrizes((ps) => ps.filter((_, j) => j !== i));
  }

  // Active/désactive une action déclenchante. Garde-fou : on ne peut jamais
  // désactiver la dernière action active (au moins une doit rester).
  function toggleTriggerAction(id: string) {
    // Réducteur pur : purge les actions verrouillées, refuse la dernière action
    // et une action non sélectionnable, conserve l'ordre canonique.
    setConfig((c) => ({
      ...c,
      trigger_actions: nextTriggerActions(c.trigger_actions, id, {
        fideliteAvailable: showFidelite && !!c.loyalty_enabled,
      }),
    }));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    setIsErr(false);
    try {
      // Persiste le set EFFECTIF : une action verrouillée (ex. Fidélité hors
      // formule) est purgée à l'enregistrement, donc le jeu ne la propose plus.
      const resolvedActions = resolveTriggerActions(config.trigger_actions, {
        fideliteAvailable: showFidelite && !!config.loyalty_enabled,
      });
      const res = await fetch("/api/dashboard/wheel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: { ...config, trigger_actions: resolvedActions },
          prizes,
        }),
      });
      if (res.ok) {
        setIsErr(false);
        setMsg("Enregistré !");
      } else {
        const d = await res.json().catch(() => ({}));
        setIsErr(true);
        setMsg(d.detail || d.error || "Échec de l'enregistrement.");
      }
    } catch {
      setIsErr(true);
      setMsg("Connexion impossible.");
    } finally {
      setSaving(false);
    }
  }

  const activeTheme = matchTheme(config);
  // Aperçu thématisé : le fond et les textes suivent le thème choisi, pour
  // que le commerçant voie l'effet en direct.
  const pvBg = config.bg_color || "#150c29";
  const pvLight = hexLum(pvBg) > 0.55;
  const pvInk = pvLight ? "#241b35" : "#fdf4e3";
  const pvInkDim = pvLight ? "rgba(36,27,53,.6)" : "rgba(253,244,227,.7)";
  const pvPrimary = config.primary_color || "#ffc24d";
  const pvDecor = splitDecor(config.decor_emojis || "");
  const totalWeight = prizes.reduce((s, p) => s + Math.max(0, Number(p.weight) || 0), 0);
  const rvEnabled = config.review_enabled !== false;
  // Set EFFECTIF (actions verrouillées purgées) : sert à l'affichage, au garde
  // « au moins une active » et à ce qui est persisté.
  const triggerActions = resolveTriggerActions(config.trigger_actions, {
    fideliteAvailable: showFidelite && !!config.loyalty_enabled,
  });

  const stampEmoji = config.loyalty_stamp_emoji || "⭐";
  const rewardEmoji = config.loyalty_reward_emoji || "🎁";
  const goal = config.loyalty_goal ?? 10;

  return (
    <>
      <h1 className="dash-h1">{showRoue ? "Mon jeu" : "Ma fidélité"}</h1>
      <p className="dash-sub">
        {showRoue
          ? "Choisissez votre jeu, vos cadeaux, vos liens et vos couleurs. L'aperçu se met à jour en direct."
          : "Configurez votre carte de fidélité : récompense, nombre de tampons, emoji."}
      </p>

      <div className="editor">
        <div className="editor-form">
          {TABS.length > 1 && (
            <div className="editor-tabs" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={`editor-tab${tab === t.id ? " on" : ""}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
          {showRoue && tab === "look" && (
            <>
              <div className="dash-card">
                <h2>Logo</h2>
                <div className="logo-row">
                  <div className="logo-preview">
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt="Logo" loading="lazy" decoding="async" />
                    ) : (
                      <span>Aucun logo</span>
                    )}
                  </div>
                  <label className="btn-secondary logo-btn">
                    {uploading ? "Envoi…" : logoUrl ? "Changer le logo" : "Ajouter un logo"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={uploadLogo}
                      disabled={uploading}
                      hidden
                    />
                  </label>
                </div>
                <p className="muted">PNG ou JPG, 3 Mo max. Il s'affiche sur ta page de jeu.</p>
              </div>

              <div className="dash-card">
                <h2>Image de fond</h2>
                <div className="logo-row">
                  <div className="bg-preview">
                    {bgUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={bgUrl} alt="Fond" loading="lazy" decoding="async" />
                    ) : (
                      <span>Aucune image</span>
                    )}
                  </div>
                  <div className="bg-actions">
                    <label className="btn-secondary logo-btn">
                      {uploadingBg ? "Envoi…" : bgUrl ? "Changer l'image" : "Ajouter une image"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={uploadBackground}
                        disabled={uploadingBg}
                        hidden
                      />
                    </label>
                    {bgUrl && (
                      <button
                        type="button"
                        className="btn-mini danger"
                        onClick={removeBackground}
                        disabled={uploadingBg}
                      >
                        Retirer
                      </button>
                    )}
                  </div>
                </div>
                <p className="muted">
                  Une photo de ton commerce ou de tes plats (JPG/PNG, 6 Mo max). Un
                  voile sombre est ajouté pour garder le texte lisible.
                </p>
              </div>

              <div className="dash-card">
                <h2>Apparence de la page</h2>
                {themeLocked ? (
                  <div className="fid-lock-banner" style={{ marginTop: 4 }}>
                    <span style={{ fontSize: 20 }}>🎨</span>
                    <div>
                      <b>Page personnalisée par notre équipe</b>
                      <span>
                        Votre page de jeu a été mise aux couleurs de votre
                        établissement dans le cadre de la formule{" "}
                        <b>Installation clé en main</b>. Pour une retouche,
                        écrivez-nous — on s'en occupe.
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="muted" style={{ marginBottom: 14 }}>
                      Choisissez l'ambiance de votre page. Les couleurs et les
                      textes s'adaptent automatiquement pour rester lisibles.
                    </p>
                    <div className="theme-cards">
                      {GAME_THEMES.map((t) => {
                        const on = activeTheme === t.id;
                        const light = t.bg.toLowerCase() > "#999999";
                        return (
                          <button
                            key={t.id}
                            type="button"
                            className={`theme-card${on ? " on" : ""}`}
                            onClick={() =>
                              setConfig({
                                ...config,
                                primary_color: t.primary,
                                accent_color: t.accent,
                                bg_color: t.bg,
                                decor_emojis: t.decor,
                              })
                            }
                            aria-pressed={on}
                          >
                            <span
                              className="theme-card-swatch"
                              style={{ background: t.bg }}
                            >
                              <i style={{ background: t.primary }} />
                              <i style={{ background: t.accent }} />
                              {t.decor && (
                                <em
                                  style={{
                                    color: light ? "#241b35" : "#fff",
                                  }}
                                >
                                  {t.decor.slice(0, 4)}
                                </em>
                              )}
                            </span>
                            <b>{t.name}</b>
                            <small>{t.hint}</small>
                            {on && <span className="theme-card-on">✓ Choisi</span>}
                          </button>
                        );
                      })}
                    </div>
                    <p
                      className="muted"
                      style={{ margin: "12px 0 0", fontSize: 12.5 }}
                    >
                      💡 Vous voulez une page 100 % à vos couleurs, avec vos
                      photos et un décor sur-mesure ? C'est inclus dans la
                      formule <b>Installation clé en main</b> : on la crée pour
                      vous.
                    </p>
                  </>
                )}
              </div>
            </>
          )}
          {showRoue && tab === "game" && (
            <>
              <div className="dash-card">
                <h2>Type de jeu</h2>
                <p className="muted" style={{ marginBottom: 14 }}>
                  Roue, carte à gratter ou machine à sous — même principe dans
                  les trois cas : vos cadeaux, vos probabilités, votre code à
                  valider en caisse.
                </p>
                <div className="game-type-grid">
                  {GAME_TYPES.map((g) => (
                    <button
                      type="button"
                      key={g.id}
                      className={`game-chip${(config.game_type ?? "wheel") === g.id ? " on" : ""}`}
                      onClick={() => setConfig({ ...config, game_type: g.id })}
                      aria-pressed={(config.game_type ?? "wheel") === g.id}
                    >
                      <span className="game-chip-e">{g.emoji}</span>
                      <b>{g.label}</b>
                      <small>{g.desc}</small>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {showRoue && tab === "links" && (
            <>
              <div className="dash-card">
                <h2>Canaux &amp; liens</h2>
                <p className="muted" style={{ marginBottom: 14 }}>
                  Renseignez les liens utilisés par vos actions. Ce sont les
                  <b> actions qui débloquent un tour</b> (plus bas) qui décident
                  des tours. Le lien avis Google est <b>facultatif et non
                  récompensé</b> : il n'offre ni tour ni cadeau.
                </p>

                {triggerActions.includes("instagram") ? (
                  <label className="field">
                    <span>Lien Instagram</span>
                    <input
                      type="url"
                      placeholder="https://instagram.com/mon-compte"
                      value={config.instagram_url ?? ""}
                      onChange={(e) =>
                        setConfig({ ...config, instagram_url: e.target.value })
                      }
                    />
                    {!config.instagram_url?.trim() && (
                      <span className="onboarding-err" style={{ marginTop: 4 }}>
                        L'action Instagram est active mais aucun lien n'est
                        renseigné : le bouton n'ouvrira rien.
                      </span>
                    )}
                  </label>
                ) : (
                  <p className="muted" style={{ marginBottom: 14 }}>
                    Activez l'action <b>Instagram</b> ci-dessous pour renseigner
                    votre lien.
                  </p>
                )}

                <label className="toggle-field" style={{ marginTop: 6 }}>
                  <input
                    type="checkbox"
                    checked={rvEnabled}
                    onChange={(e) =>
                      setConfig({ ...config, review_enabled: e.target.checked })
                    }
                  />
                  <span>
                    <b>Afficher un lien avis Google</b> — facultatif,{" "}
                    <b>non récompensé</b> (aucun tour ni cadeau lié).
                  </span>
                </label>
                {rvEnabled && (
                  <label className="field">
                    <span>Lien d'avis Google</span>
                    <input
                      type="url"
                      placeholder="https://g.page/r/..."
                      value={config.review_url ?? ""}
                      onChange={(e) =>
                        setConfig({ ...config, review_url: e.target.value })
                      }
                    />
                  </label>
                )}

                {(config.review_url ?? "").trim() !== "" ? (
                  <label className="toggle-field" style={{ marginTop: 6 }}>
                    <input
                      type="checkbox"
                      checked={!!config.review_invite}
                      onChange={(e) =>
                        setConfig({ ...config, review_invite: e.target.checked })
                      }
                    />
                    <span>
                      <b>⭐ Inviter mes clients fidèles à laisser un avis</b> —
                      un e-mail neutre, envoyé une seule fois aux clients ayant
                      complété au moins une carte. <b>Aucune récompense liée à
                      l'avis</b> (conforme aux règles Google).
                    </span>
                  </label>
                ) : (
                  <p className="muted" style={{ marginTop: 6 }}>
                    Renseignez votre <b>lien d'avis Google</b> ci-dessus pour
                    pouvoir inviter vos clients fidèles à laisser un avis.
                  </p>
                )}

                <hr className="fid-sep" />
                <h2 style={{ marginTop: 0 }}>Actions qui débloquent un tour</h2>
                <p className="muted" style={{ marginBottom: 14 }}>
                  Choisissez les actions qui offrent un tour à vos clients. Au
                  moins une action doit rester active.
                </p>
                {TRIGGER_ACTION_OPTIONS.map((opt) => {
                  const on = triggerActions.some((a) => a === opt.id);
                  const selectable = isTriggerActionSelectable(opt.id, {
                    fideliteAvailable: showFidelite && !!config.loyalty_enabled,
                  });
                  const isLast = on && triggerActions.length <= 1;
                  const disabled = isLast || !selectable;
                  return (
                    <label
                      key={opt.id}
                      className={`toggle-field${disabled ? " is-disabled" : ""}`}
                      style={{ marginTop: 6 }}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={disabled}
                        onChange={() => toggleTriggerAction(opt.id)}
                      />
                      <span>
                        <b>
                          {opt.emoji} {opt.label}
                        </b>{" "}
                        — {opt.desc}
                        {!selectable && (
                          <>
                            {" "}
                            <em>
                              (incluse dans les formules Complet ou Fidélité)
                            </em>
                          </>
                        )}
                      </span>
                    </label>
                  );
                })}

                <label className="field">
                  <span>Mention légale (conformité)</span>
                  <input
                    type="text"
                    value={config.compliance_note ?? ""}
                    onChange={(e) =>
                      setConfig({ ...config, compliance_note: e.target.value })
                    }
                  />
                </label>
                <label className="toggle-field">
                  <input
                    type="checkbox"
                    checked={!!config.collect_email}
                    onChange={(e) =>
                      setConfig({ ...config, collect_email: e.target.checked })
                    }
                  />
                  <span>
                    <b>Collecter les e-mails des gagnants</b> (facultatif, avec
                    consentement) — pour te constituer une base clients.
                  </span>
                </label>

                {/* « À la une » : message montré aux clients (jeu + fidélité). */}
                <div className="field" style={{ gap: 4 }}>
                  <span>📣 À la une (facultatif)</span>
                  <p className="muted" style={{ margin: "0 0 6px" }}>
                    Un petit message pour tes clients (menu du jour, événement à
                    venir, actu…), affiché sur la page de jeu et la carte de
                    fidélité. Laisse vide pour ne rien afficher.
                  </p>
                </div>
                <label className="field">
                  <span>Titre</span>
                  <input
                    type="text"
                    maxLength={60}
                    placeholder="Ex : Menu du jour"
                    value={config.highlight_title ?? ""}
                    onChange={(e) =>
                      setConfig({ ...config, highlight_title: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>Message</span>
                  <input
                    type="text"
                    maxLength={160}
                    placeholder="Ex : Aujourd'hui, tarte aux pommes maison 🍎"
                    value={config.highlight_text ?? ""}
                    onChange={(e) =>
                      setConfig({ ...config, highlight_text: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>Lien (facultatif)</span>
                  <input
                    type="text"
                    placeholder="https://…"
                    value={config.highlight_url ?? ""}
                    onChange={(e) =>
                      setConfig({ ...config, highlight_url: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>Masquer automatiquement après le (facultatif)</span>
                  <input
                    type="date"
                    value={(config.highlight_until ?? "").slice(0, 10)}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        highlight_until: e.target.value || null,
                      })
                    }
                  />
                </label>
              </div>
            </>
          )}

          {(showFidelite || showRoue) && (!showRoue || tab === "fid") && (
            <div className={`dash-card fid-card${fideliteLocked ? " locked" : ""}`}>
              <div className="fid-card-head">
                <h2>
                  <Icon name="loyalty" size={20} /> Carte de fidélité
                </h2>
                {fideliteLocked && (
                  <span className="fid-lock-tag">
                    <Icon name="lock" size={13} /> Formule Complet ou Fidélité
                  </span>
                )}
              </div>
              <p className="muted" style={{ marginBottom: 14 }}>
                Une carte à tampons digitale, sans appli : vos clients cumulent des
                tampons à chaque passage et gagnent une récompense. Vous validez
                chaque tampon en caisse (onglet « Valider en caisse »).
              </p>

              {fideliteLocked && (
                <div className="fid-lock-banner">
                  <Icon name="lock" size={18} />
                  <div>
                    <b>Fonctionnalité verrouillée</b>
                    <span>
                      La carte de fidélité est incluse dans les formules{" "}
                      <b>Complet</b> (44 €) et <b>Fidélité</b> (19 €). Passez à
                      l'une d'elles pour l'activer.
                    </span>
                  </div>
                  <a href="/dashboard/billing" className="btn-mini-upgrade">
                    Changer de formule →
                  </a>
                </div>
              )}

              <label className={`toggle-field${fideliteLocked ? " is-disabled" : ""}`}>
                <input
                  type="checkbox"
                  checked={!!config.loyalty_enabled}
                  disabled={fideliteLocked}
                  onChange={(e) =>
                    setConfig({ ...config, loyalty_enabled: e.target.checked })
                  }
                />
                <span>
                  <b>Activer la carte de fidélité</b> — un lien « Ma carte » sera
                  proposé à vos clients.
                </span>
              </label>

              {config.loyalty_enabled && !fideliteLocked && (
                <>
                  <label className="field">
                    <span>Nombre de tampons pour gagner (2 à 30)</span>
                    <input
                      type="number"
                      min={2}
                      max={30}
                      value={goal}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          loyalty_goal: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Récompense à la carte complète</span>
                    <input
                      type="text"
                      placeholder="Ex. Une boisson offerte"
                      value={config.loyalty_reward ?? ""}
                      onChange={(e) =>
                        setConfig({ ...config, loyalty_reward: e.target.value })
                      }
                    />
                  </label>
                  <label className="field" style={{ marginBottom: 6 }}>
                    <span>Emoji de la récompense</span>
                  </label>
                  <div className="emoji-picker">
                    {REWARD_EMOJIS.map((e) => (
                      <button
                        type="button"
                        key={e}
                        className={`emoji-opt${rewardEmoji === e ? " on" : ""}`}
                        onClick={() =>
                          setConfig({ ...config, loyalty_reward_emoji: e })
                        }
                        aria-label={`Emoji ${e}`}
                      >
                        {e}
                      </button>
                    ))}
                    <input
                      type="text"
                      className="emoji-custom"
                      maxLength={4}
                      value={rewardEmoji}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          loyalty_reward_emoji: e.target.value,
                        })
                      }
                      placeholder="Autre"
                    />
                  </div>

                  <label className="field" style={{ marginBottom: 6 }}>
                    <span>Emoji du tampon (affiché sur la carte client)</span>
                  </label>
                  <div className="emoji-picker">
                    {STAMP_EMOJIS.map((e) => (
                      <button
                        type="button"
                        key={e}
                        className={`emoji-opt${stampEmoji === e ? " on" : ""}`}
                        onClick={() =>
                          setConfig({ ...config, loyalty_stamp_emoji: e })
                        }
                        aria-label={`Emoji ${e}`}
                      >
                        {e}
                      </button>
                    ))}
                    <input
                      type="text"
                      className="emoji-custom"
                      maxLength={4}
                      value={stampEmoji}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          loyalty_stamp_emoji: e.target.value,
                        })
                      }
                      placeholder="Autre"
                    />
                  </div>

                  <div className="fid-preview-box">
                    <div className="fid-preview-title">
                      <Icon name="loyalty" size={16} /> Aperçu de la carte client
                    </div>
                    <div className="fid-preview-card">
                      <div className="fid-preview-head">
                        <b>{config.loyalty_reward_emoji || "🎁"} Carte de fidélité</b>
                        <small>3 / {goal}</small>
                      </div>
                      <div className="fid-preview-grid">
                        {Array.from({ length: goal }, (_, i) => (
                          <span
                            key={i}
                            className={`fid-preview-stamp${i < 3 ? " filled" : ""}`}
                          >
                            {i < 3 ? stampEmoji : i + 1}
                          </span>
                        ))}
                      </div>
                      <div className="fid-preview-goal">
                        {goal} tampons ={" "}
                        <b>
                          {config.loyalty_reward_emoji || "🎁"}{" "}
                          {config.loyalty_reward || "une récompense offerte"}
                        </b>
                      </div>
                    </div>
                  </div>

                  <hr className="fid-sep" />

                  <label className="toggle-field">
                    <input
                      type="checkbox"
                      checked={!!config.birthday_enabled}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          birthday_enabled: e.target.checked,
                        })
                      }
                    />
                    <span>
                      <b>🎂 Offre d'anniversaire</b> — vos clients reçoivent
                      automatiquement un e-mail avec votre offre le jour de leur
                      anniversaire.
                    </span>
                  </label>
                  {config.birthday_enabled && (
                    <label className="field">
                      <span>Votre offre d'anniversaire</span>
                      <input
                        type="text"
                        placeholder="Ex. Un dessert offert cette semaine"
                        value={config.birthday_reward ?? ""}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            birthday_reward: e.target.value,
                          })
                        }
                      />
                    </label>
                  )}

                  <label className="toggle-field" style={{ marginTop: 6 }}>
                    <input
                      type="checkbox"
                      checked={!!config.reengage_almost}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          reengage_almost: e.target.checked,
                        })
                      }
                    />
                    <span>
                      <b>🎯 Relance « plus qu'un tampon »</b> — quand un client
                      est à un tampon de sa récompense, il reçoit
                      automatiquement un e-mail pour l'inviter à revenir
                      (uniquement s'il a accepté vos offres).
                    </span>
                  </label>

                  <label className="toggle-field" style={{ marginTop: 6 }}>
                    <input
                      type="checkbox"
                      checked={!!config.reengage_inactive}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          reengage_inactive: e.target.checked,
                        })
                      }
                    />
                    <span>
                      <b>👋 Relance « client inactif »</b> — un client qui n'est
                      pas repassé depuis un moment reçoit un e-mail pour l'inviter
                      à revenir (uniquement s'il a accepté vos offres).
                    </span>
                  </label>
                  {config.reengage_inactive && (
                    <label className="field">
                      <span>Après combien de jours sans visite ?</span>
                      <input
                        type="number"
                        min={7}
                        max={180}
                        value={config.reengage_inactive_days ?? 30}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            reengage_inactive_days: Number(e.target.value) || 30,
                          })
                        }
                      />
                    </label>
                  )}

                  <label className="toggle-field" style={{ marginTop: 6 }}>
                    <input
                      type="checkbox"
                      checked={!!config.reengage_reward}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          reengage_reward: e.target.checked,
                        })
                      }
                    />
                    <span>
                      <b>🎉 E-mail « récompense débloquée »</b> — quand un client
                      complète sa carte, il reçoit un e-mail de félicitations avec
                      le code de sa récompense à présenter en caisse.
                    </span>
                  </label>

                  <label className="toggle-field" style={{ marginTop: 6 }}>
                    <input
                      type="checkbox"
                      checked={!!config.convert_nudge}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          convert_nudge: e.target.checked,
                        })
                      }
                    />
                    <span>
                      <b>🎟️ Inviter les joueurs à ouvrir leur carte</b> — un
                      joueur qui a laissé son e-mail mais n'a pas de carte de
                      fidélité reçoit une invitation (une seule fois) à en
                      ouvrir une.
                    </span>
                  </label>

                  <label className="toggle-field" style={{ marginTop: 6 }}>
                    <input
                      type="checkbox"
                      checked={!!config.feedback_enabled}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          feedback_enabled: e.target.checked,
                        })
                      }
                    />
                    <span>
                      <b>💬 Recueillir les avis privés</b> — un bouton « Un souci
                      ? Dites-le nous » s'affiche sur vos pages jeu et fidélité.
                      Les clients vous écrivent en privé (vous êtes alerté), au
                      lieu de laisser un avis Google négatif.
                    </span>
                  </label>

                  <label className="toggle-field" style={{ marginTop: 6 }}>
                    <input
                      type="checkbox"
                      checked={!!config.referral_enabled}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          referral_enabled: e.target.checked,
                        })
                      }
                    />
                    <span>
                      <b>🤝 Parrainage client</b> — le parrain gagne{" "}
                      <b>+1 tampon</b> quand son filleul fait son{" "}
                      <b>premier achat</b> (premier tampon validé en caisse).
                      Une seule fois par filleul.
                    </span>
                  </label>
                </>
              )}
            </div>
          )}

          {showRoue && tab === "game" && (
            <div className="dash-card">
              <h2>Cadeaux</h2>
              <p className="muted">
                Le « poids » définit la probabilité relative (total actuel :{" "}
                {totalWeight}). Un lot « Rien… » gère les cas sans gain.
              </p>
              <label className="field">
                <span>Nombre de cadeaux max par jour (vide = illimité)</span>
                <input
                  type="number"
                  min={0}
                  placeholder="illimité"
                  value={config.daily_prize_limit ?? ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      daily_prize_limit:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
              <p className="muted" style={{ marginBottom: 12 }}>
                Une fois ce nombre de cadeaux atteint dans la journée, la roue ne
                donne plus que « Rien » (nécessite un lot « Rien… » dans la liste).
              </p>
              <label className="field">
                <span>Durée de validité des cadeaux gagnés</span>
                <select
                  value={config.prize_validity_days ?? ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      prize_validity_days:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                >
                  <option value={7}>7 jours</option>
                  <option value={14}>14 jours</option>
                  <option value={30}>30 jours</option>
                  <option value={60}>60 jours</option>
                  <option value={90}>90 jours</option>
                  <option value="">Illimitée</option>
                </select>
              </label>
              <p className="muted" style={{ marginBottom: 12 }}>
                Passé ce délai, le code cadeau est refusé en caisse. La validité
                est affichée au client quand il gagne.
              </p>
              <label className="toggle-field">
                <input
                  type="checkbox"
                  checked={!!config.one_prize_per_day}
                  onChange={(e) =>
                    setConfig({ ...config, one_prize_per_day: e.target.checked })
                  }
                />
                <span>
                  <b>🎁 1 cadeau récupérable par jour et par client</b> — même
                  s'il gagne plusieurs cadeaux, un client n'en fait valider qu'un
                  seul par jour en caisse (les autres restent valables un autre
                  jour).
                </span>
              </label>
              <hr className="fid-sep" />
              <label className="toggle-field">
                <input
                  type="checkbox"
                  checked={!!config.play_alerts}
                  onChange={(e) =>
                    setConfig({ ...config, play_alerts: e.target.checked })
                  }
                />
                <span>
                  <b>🔔 M'alerter à chaque cadeau gagné</b> — recevez une
                  notification en temps réel dès qu'un client remporte un lot.
                </span>
              </label>
              {config.play_alerts && <EnableNotifications />}
              <hr className="fid-sep" />
              <div className="prize-list">
                {prizes.map((p, i) => (
                  <div className="prize-row" key={i}>
                    <input
                      className="p-emoji"
                      value={p.emoji}
                      onChange={(e) => update(i, { emoji: e.target.value })}
                      aria-label="Emoji"
                    />
                    <input
                      className="p-label"
                      value={p.label}
                      onChange={(e) => update(i, { label: e.target.value })}
                      aria-label="Nom du lot"
                    />
                    <input
                      className="p-weight"
                      type="number"
                      min={0}
                      value={p.weight}
                      onChange={(e) =>
                        update(i, { weight: Number(e.target.value) })
                      }
                      aria-label="Poids"
                    />
                    <input
                      className="p-color"
                      type="color"
                      value={p.color}
                      onChange={(e) => update(i, { color: e.target.value })}
                      aria-label="Couleur"
                    />
                    <button
                      className="p-del"
                      onClick={() => removePrize(i)}
                      aria-label="Supprimer"
                      disabled={prizes.length <= 1}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button className="btn-secondary" onClick={addPrize}>
                + Ajouter un cadeau
              </button>
            </div>
          )}

          {showRoue && tab === "draw" && (
            <div className="dash-card">
              <h2>🎲 Tirage au sort</h2>
              <p className="muted" style={{ marginBottom: 14 }}>
                Un gagnant tiré au hasard, à la fréquence de votre choix, parmi
                les clients ayant laissé leur e-mail. Idéal pour faire revenir
                vos clients — ils veulent savoir s'ils ont gagné&nbsp;!
              </p>
              <label className="toggle-field">
                <input
                  type="checkbox"
                  checked={!!config.monthly_draw}
                  onChange={(e) =>
                    setConfig({ ...config, monthly_draw: e.target.checked })
                  }
                />
                <span>
                  <b>Activer le tirage au sort</b> — nécessite de collecter les
                  e-mails des joueurs (option « Canaux &amp; liens »).
                </span>
              </label>
              {config.monthly_draw && (
                <>
                  <label className="field">
                    <span>Lot à gagner</span>
                    <input
                      type="text"
                      maxLength={80}
                      placeholder="Ex. Un menu pour deux offert"
                      value={config.monthly_draw_prize ?? ""}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          monthly_draw_prize: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Fréquence du tirage</span>
                    <select
                      value={config.draw_period_days ?? 30}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          draw_period_days: Number(e.target.value),
                        })
                      }
                    >
                      <option value={7}>Chaque semaine</option>
                      <option value={14}>Toutes les 2 semaines</option>
                      <option value={30}>Chaque mois</option>
                      <option value={90}>Chaque trimestre</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Date du prochain tirage</span>
                    <input
                      type="date"
                      value={(config.draw_next_at ?? "").slice(0, 10)}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          draw_next_at: e.target.value || null,
                        })
                      }
                    />
                  </label>
                  <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                    Le tirage a lieu à cette date, puis se répète
                    automatiquement selon la fréquence choisie. ⚖️ Jeu gratuit
                    sans obligation d'achat — le gagnant reçoit un code par
                    e-mail, vous êtes prévenu(e) aussi.
                  </p>
                </>
              )}
            </div>
          )}

          <div className="save-bar">
            <button className="btn" onClick={save} disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            {msg && (
              <span className={isErr ? "save-msg is-err" : "save-msg"}>
                {msg}
              </span>
            )}
          </div>
        </div>

        {showRoue && (
          <div className="editor-preview">
            <div
              className="dash-card preview-card"
              style={{
                background: pvBg,
                color: pvInk,
                borderColor: pvLight
                  ? "rgba(0,0,0,.1)"
                  : "rgba(255,255,255,.14)",
              }}
            >
              <h2 style={{ color: pvInk }}>Aperçu</h2>
              <div
                className="preview-stage"
                style={{ ["--pv-primary" as any]: pvPrimary }}
              >
                {pvDecor.length > 0 && (
                  <div className="preview-decor" aria-hidden="true">
                    {[
                      { t: "8%", l: "6%" },
                      { t: "12%", l: "86%" },
                      { t: "78%", l: "4%" },
                      { t: "82%", l: "88%" },
                    ].map((p, i) => (
                      <span key={i} style={{ top: p.t, left: p.l }}>
                        {pvDecor[i % pvDecor.length]}
                      </span>
                    ))}
                  </div>
                )}
                <canvas ref={canvasRef} width={520} height={520} className="preview-wheel" />
              </div>
              <p
                className="preview-hint"
                style={{ color: pvInkDim, marginTop: 10 }}
              >
                {(config.game_type ?? "wheel") !== "wheel" ? (
                  <>
                    {config.game_type === "scratch" ? "🎫" : "🎰"} Vos clients
                    joueront à la{" "}
                    {config.game_type === "scratch"
                      ? "carte à gratter"
                      : "machine à sous"}{" "}
                    avec ces mêmes cadeaux et couleurs.
                  </>
                ) : (
                  <>Voici l'ambiance et les couleurs de votre page.</>
                )}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
