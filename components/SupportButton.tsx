"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Bouton d'assistance flottant : WhatsApp ou e-mail en deux tapes, sans
 * quitter la page. Deux tons : commerçant connecté (assistance) ou visiteur
 * du site (question avant inscription).
 */
export default function SupportButton({
  business,
  prospect = false,
}: {
  business?: string;
  prospect?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Fermeture au clic à l'extérieur / touche Échap
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const ctx = business ? ` (${business})` : "";
  const waText = prospect
    ? "Bonjour, je découvre Kado et j'ai une question :"
    : `Bonjour, j'ai besoin d'aide avec Kado${ctx} :`;
  const wa = `https://wa.me/33667797464?text=${encodeURIComponent(waText)}`;
  const mail = `mailto:bonjour@kado-app.fr?subject=${encodeURIComponent(
    prospect ? "Question sur Kado" : `Assistance Kado${ctx}`
  )}`;

  return (
    <div className="support" ref={boxRef}>
      {open && (
        <div className="support-pop" role="dialog" aria-label="Assistance">
          <b>{prospect ? "Une question ?" : "Besoin d'aide ?"}</b>
          <p>
            {prospect
              ? "On vous aide à démarrer — réponse rapide, sans engagement :"
              : "On vous répond vite — choisissez votre canal :"}
          </p>
          <a href={wa} target="_blank" rel="noreferrer" className="support-link">
            💬 WhatsApp <span>réponse rapide</span>
          </a>
          <a href={mail} className="support-link">
            ✉️ E-mail <span>bonjour@kado-app.fr</span>
          </a>
        </div>
      )}
      <button
        type="button"
        className={prospect ? "support-fab sunset" : "support-fab"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "✕" : prospect ? "💬 Une question ?" : "❓ Assistance"}
      </button>
    </div>
  );
}
