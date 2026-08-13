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
}: {
  initialConfig: Config;
  initialPrizes: Prize[];
}) {
  const [config, setConfig] = useState<Config>(initialConfig);
  const [prizes, setPrizes] = useState<Prize[]>(
    initialPrizes.length
      ? initialPrizes
      : [{ label: "Café offert", emoji: "☕", weight: 20, color: "#ff5d73" }]
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
