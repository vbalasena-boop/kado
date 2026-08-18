"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { GAME_THEMES } from "@/lib/themes";

// Ambiances « métier » réservées à l'admin (personnalisation sur-mesure).
const ADMIN_PRESETS = [
  {
    n: "🍝 Trattoria QUSTOS",
    p: "#1f7a44",
    a: "#c23b2e",
    b: "#f2ede1",
    d: "🍅🍆🍄🥕🌿🍝",
  },
  { n: "☕ Coffee shop", p: "#8a5a34", a: "#c98a4b", b: "#faf5ee", d: "☕🥐🍪" },
  { n: "💇 Beauté", p: "#c98ab0", a: "#8a5ac9", b: "#fdf7fb", d: "✨💅🌸" },
  { n: "🍕 Pizzeria", p: "#c0392b", a: "#2e7d4f", b: "#fbf6ee", d: "🍕🍅🌿🧀" },
  { n: "🍔 Burger / snack", p: "#e0872f", a: "#c0392b", b: "#fff8ef", d: "🍔🍟🥤" },
];

type Initial = {
  primary: string;
  accent: string;
  bg: string;
  decor: string;
  locked: boolean;
};

export default function AdminThemeEditor({
  businessId,
  slug,
  name,
  hasInstall,
  installKind,
  initial,
}: {
  businessId: string;
  slug: string;
  name: string;
  hasInstall: boolean;
  installKind: string | null;
  initial: Initial;
}) {
  const [primary, setPrimary] = useState(initial.primary || "#ffc24d");
  const [accent, setAccent] = useState(initial.accent || "#ff5d73");
  const [bg, setBg] = useState(initial.bg || "#150c29");
  const [decor, setDecor] = useState(initial.decor || "");
  const [locked, setLocked] = useState(initial.locked);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isErr, setIsErr] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  function reloadPreview() {
    const f = iframeRef.current;
    if (f) f.src = `/${slug}?preview=1&t=${Date.now()}`;
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    setIsErr(false);
    try {
      const res = await fetch(`/api/admin/business/${businessId}/theme`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primary, accent, bg, decor }),
      });
      if (res.ok) {
        setLocked(true);
        setMsg("Page personnalisée et verrouillée. Aperçu mis à jour.");
        setTimeout(reloadPreview, 400);
      } else {
        const d = await res.json().catch(() => ({}));
        setIsErr(true);
        setMsg(d.detail || d.error || "Échec de l'enregistrement.");
      }
    } catch {
      setIsErr(true);
      setMsg("Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function unlock() {
    if (
      !confirm(
        "Rendre la main au commerçant ? Il pourra de nouveau choisir parmi les 3 thèmes standard."
      )
    )
      return;
    setBusy(true);
    setMsg(null);
    setIsErr(false);
    try {
      const res = await fetch(`/api/admin/business/${businessId}/theme`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unlock: true }),
      });
      if (res.ok) {
        setLocked(false);
        setMsg("Déverrouillé : le commerçant peut de nouveau choisir un thème.");
      } else {
        setIsErr(true);
        setMsg("Échec du déverrouillage.");
      }
    } catch {
      setIsErr(true);
      setMsg("Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Link href="/admin" className="admin-back">
        ← Retour à l'admin
      </Link>
      <h1 className="dash-h1">🎨 Personnaliser la page — {name}</h1>
      <p className="dash-sub">
        Mettez la page de jeu aux couleurs de l'établissement. En enregistrant,
        la page est <b>verrouillée</b> : le commerçant ne peut plus la changer
        (mais vous, si).
      </p>

      {!hasInstall && (
        <div className="fid-lock-banner" style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 20 }}>ℹ️</span>
          <div>
            <b>Cet établissement n'a pas pris la formule Installation</b>
            <span>
              Vous pouvez tout de même personnaliser sa page (geste commercial),
              mais la personnalisation sur-mesure est normalement réservée aux
              clients « Installation clé en main ».
            </span>
          </div>
        </div>
      )}
      {hasInstall && (
        <div className="setup-chip done" style={{ marginBottom: 16 }}>
          🛠️ Formule Installation{" "}
          {installKind === "onsite" ? "(sur place)" : "(à distance)"} — page
          sur-mesure incluse.
        </div>
      )}

      <div className="editor">
        <div className="editor-form">
          <div className="dash-card">
            <h2>Couleurs</h2>
            <p className="muted" style={{ margin: "0 0 8px", fontSize: 12.5 }}>
              Thèmes neutres (comme côté commerçant)
            </p>
            <div className="theme-presets">
              {GAME_THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="theme-preset"
                  style={{ background: t.bg, color: t.primary, borderColor: t.primary }}
                  onClick={() => {
                    setPrimary(t.primary);
                    setAccent(t.accent);
                    setBg(t.bg);
                    setDecor(t.decor);
                  }}
                >
                  {t.name}
                </button>
              ))}
            </div>
            <p className="muted" style={{ margin: "12px 0 8px", fontSize: 12.5 }}>
              Ambiances métier (sur-mesure, avec décor animé)
            </p>
            <div className="theme-presets">
              {ADMIN_PRESETS.map((t) => (
                <button
                  key={t.n}
                  type="button"
                  className="theme-preset"
                  style={{ background: t.b, color: t.p, borderColor: t.p }}
                  onClick={() => {
                    setPrimary(t.p);
                    setAccent(t.a);
                    setBg(t.b);
                    setDecor(t.d);
                  }}
                >
                  {t.n}
                </button>
              ))}
            </div>
            <div className="color-row">
              <label className="field color-field">
                <span>Couleur principale</span>
                <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} />
              </label>
              <label className="field color-field">
                <span>Couleur d'accent</span>
                <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />
              </label>
              <label className="field color-field">
                <span>Couleur de fond</span>
                <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} />
              </label>
            </div>
            <p className="muted" style={{ margin: "4px 0 14px", fontSize: 12.5 }}>
              💡 Fond clair → les textes passent automatiquement en sombre.
              Collez les codes couleur du site du commerçant pour un rendu
              parfaitement assorti.
            </p>
            <label className="field">
              <span>Décor animé (emojis flottants, vide = aucun)</span>
              <input
                type="text"
                maxLength={40}
                placeholder="Ex. 🍝🍅🌿🫒 pour un restaurant italien"
                value={decor}
                onChange={(e) => setDecor(e.target.value)}
              />
            </label>
          </div>

          <div className="save-bar">
            <button className="btn" onClick={save} disabled={busy}>
              {busy ? "Enregistrement…" : "Enregistrer & verrouiller"}
            </button>
            {locked && (
              <button className="btn-secondary" onClick={unlock} disabled={busy}>
                Déverrouiller
              </button>
            )}
            {msg && (
              <span className={isErr ? "save-msg is-err" : "save-msg"}>{msg}</span>
            )}
          </div>
          {locked && (
            <p className="muted" style={{ marginTop: 6 }}>
              🔒 Page actuellement verrouillée : le commerçant voit « Page
              personnalisée par notre équipe » dans son espace.
            </p>
          )}
        </div>

        <div className="editor-preview">
          <div className="dash-card preview-card">
            <h2>Aperçu en direct</h2>
            <div className="theme-phone">
              <iframe
                ref={iframeRef}
                src={`/${slug}?preview=1`}
                title="Aperçu de la page"
                className="theme-phone-frame"
              />
            </div>
            <button className="btn-secondary" onClick={reloadPreview} style={{ marginTop: 10 }}>
              ↻ Rafraîchir l'aperçu
            </button>
            <p className="muted" style={{ marginTop: 8, fontSize: 12.5 }}>
              L'aperçu se met à jour après l'enregistrement.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
