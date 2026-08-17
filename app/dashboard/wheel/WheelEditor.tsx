"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";

type Prize = {
  label: string;
  emoji: string;
  weight: number;
  color: string;
};
type Config = {
  primary_color: string;
  instagram_url: string | null;
  review_url: string | null;
  compliance_note: string | null;
  daily_prize_limit?: number | null;
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
};

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

  async function save() {
    setSaving(true);
    setMsg(null);
    setIsErr(false);
    try {
      const res = await fetch("/api/dashboard/wheel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, prizes }),
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

  const totalWeight = prizes.reduce((s, p) => s + Math.max(0, Number(p.weight) || 0), 0);
  const igEnabled = config.instagram_enabled !== false;
  const rvEnabled = config.review_enabled !== false;
  const noChannel = showRoue && !igEnabled && !rvEnabled;

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
          {showRoue && (
            <>
              <div className="dash-card">
                <h2>Logo</h2>
                <div className="logo-row">
                  <div className="logo-preview">
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt="Logo" />
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
                      <img src={bgUrl} alt="Fond" />
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

              <div className="dash-card">
                <h2>Canaux &amp; liens</h2>
                <p className="muted" style={{ marginBottom: 14 }}>
                  Choisissez ce que vous proposez à vos clients : Instagram, les avis
                  Google, ou les deux. Chaque canal activé donne <b>un tour de roue</b>.
                </p>

                {igEnabled && !rvEnabled && (
                  <p className="muted" style={{ marginBottom: 14 }}>
                    Vos clients auront <b>1 tour</b> (Instagram uniquement).
                  </p>
                )}
                {rvEnabled && !igEnabled && (
                  <p className="muted" style={{ marginBottom: 14 }}>
                    Vos clients auront <b>1 tour</b> (avis Google uniquement).
                  </p>
                )}

                <label className="toggle-field">
                  <input
                    type="checkbox"
                    checked={igEnabled}
                    onChange={(e) =>
                      setConfig({ ...config, instagram_enabled: e.target.checked })
                    }
                  />
                  <span>
                    <b>Proposer le tour Instagram</b> — un suivi de votre compte contre
                    un tour de roue.
                  </span>
                </label>
                {igEnabled && (
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
                  </label>
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
                    <b>Proposer le tour Avis Google</b> — un avis contre un tour de
                    roue.
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

                {!igEnabled && !rvEnabled && (
                  <p className="onboarding-err" style={{ marginTop: 4 }}>
                    Activez au moins un canal, sinon vos clients n'auront aucun tour.
                  </p>
                )}

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
              </div>
            </>
          )}

          {(showFidelite || showRoue) && (
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

          {showRoue && (
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

          <div className="save-bar">
            <button className="btn" onClick={save} disabled={saving || noChannel}>
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
            <div className="dash-card preview-card">
              <h2>Aperçu</h2>
              <canvas ref={canvasRef} width={520} height={520} className="preview-wheel" />
              {(config.game_type ?? "wheel") !== "wheel" && (
                <p className="muted" style={{ marginTop: 10 }}>
                  {config.game_type === "scratch" ? "🎫" : "🎰"} Vos clients
                  joueront à la{" "}
                  {config.game_type === "scratch"
                    ? "carte à gratter"
                    : "machine à sous"}{" "}
                  avec ces mêmes cadeaux et probabilités.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
