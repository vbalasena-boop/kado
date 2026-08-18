"use client";

import { useState } from "react";

type Fmt = "a4" | "tent" | "window";

const FORMATS: { id: Fmt; label: string; note: string }[] = [
  {
    id: "a4",
    label: "🖼️ Affiche A4",
    note: "Format standard, à afficher sur le comptoir, la porte ou au mur.",
  },
  {
    id: "tent",
    label: "🪧 Chevalet de table",
    note: "Imprimez, pliez en deux le long des pointillés, posez sur les tables.",
  },
  {
    id: "window",
    label: "🪟 Vitrine",
    note: "Grand format lisible de loin (QR et titre agrandis), à coller sur la vitrine.",
  },
];

/**
 * Outil d'affiche : le commerçant choisit le format, prévisualise, puis
 * imprime / enregistre en PDF. L'affiche (rendue côté serveur, à ses
 * couleurs) est passée en `children`.
 */
export function PosterTool({ children }: { children: React.ReactNode }) {
  const [fmt, setFmt] = useState<Fmt>("a4");
  const active = FORMATS.find((f) => f.id === fmt)!;

  return (
    <>
      <div className="poster-actions">
        <h2 className="dash-h2">Affiche à imprimer</h2>
        <p className="muted" style={{ margin: "0 0 12px" }}>
          Choisissez le format, puis imprimez. Pour un <b>PDF</b>, choisissez
          « Enregistrer au format PDF » comme destination d'impression et
          laissez l'échelle à 100&nbsp;%.
        </p>
        <div className="fmt-chips">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`fmt-chip${fmt === f.id ? " on" : ""}`}
              onClick={() => setFmt(f.id)}
              aria-pressed={fmt === f.id}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="muted" style={{ margin: "10px 0 14px", fontSize: 12.5 }}>
          {active.note}
        </p>
        <button type="button" className="btn" onClick={() => window.print()}>
          🖨️ Imprimer / Enregistrer en PDF
        </button>
      </div>

      <div className={`poster-stage fmt-${fmt}`}>{children}</div>
    </>
  );
}
