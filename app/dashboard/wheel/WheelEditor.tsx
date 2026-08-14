"use client";

import { useEffect, useRef, useState } from "react";

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
};

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

export default function WheelEditor({
  initialConfig,
  initialPrizes,
  initialLogoUrl,
  initialBgUrl,
}: {
  initialConfig: Config;
  initialPrizes: Prize[];
  initialLogoUrl?: string | null;
  initialBgUrl?: string | null;
}) {
  const [config, setConfig] = useState<Config>(initialConfig);
  const [prizes, setPrizes] = useState<Prize[]>(
    initialPrizes.length
      ? initialPrizes
      : [{ label: "Café offert", emoji: "☕", weight: 20, color: "#ff5d73" }]
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
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
        setMsg("✅ Logo mis à jour !");
      } else {
        setMsg("❌ " + (d.error || "Échec de l'envoi du logo."));
      }
    } catch {
      setMsg("❌ Connexion impossible.");
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
        setMsg("✅ Image de fond mise à jour !");
      } else {
        setMsg("❌ " + (d.error || "Échec de l'envoi de l'image."));
      }
    } catch {
      setMsg("❌ Connexion impossible.");
    } finally {
      setUploadingBg(false);
    }
  }

  async function removeBackground() {
    setUploadingBg(true);
    try {
      await fetch("/api/dashboard/background", { method: "DELETE" });
      setBgUrl(null);
      setMsg("✅ Image de fond retirée.");
    } finally {
      setUploadingBg(false);
    }
  }

  // Aperçu live de la roue
  useEffect(() => {
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
    ctx.restore();
  }, [prizes]);

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
    try {
      const res = await fetch("/api/dashboard/wheel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, prizes }),
      });
      if (res.ok) setMsg("✅ Enregistré !");
      else {
        const d = await res.json().catch(() => ({}));
        setMsg("❌ " + (d.error || "Échec de l'enregistrement."));
      }
    } catch {
      setMsg("❌ Connexion impossible.");
    } finally {
      setSaving(false);
    }
  }

  const totalWeight = prizes.reduce((s, p) => s + Math.max(0, Number(p.weight) || 0), 0);

  return (
    <>
      <h1 className="dash-h1">Ma roue</h1>
      <p className="dash-sub">
        Configurez vos cadeaux, vos liens et vos couleurs. L'aperçu se met à jour
        en direct.
      </p>

      <div className="editor">
        <div className="editor-form">
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
            <h2>Liens</h2>
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
          </div>

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

          <div className="save-bar">
            <button className="btn" onClick={save} disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            {msg && <span className="save-msg">{msg}</span>}
          </div>
        </div>

        <div className="editor-preview">
          <div className="dash-card preview-card">
            <h2>Aperçu</h2>
            <canvas ref={canvasRef} width={520} height={520} className="preview-wheel" />
          </div>
        </div>
      </div>
    </>
  );
}
