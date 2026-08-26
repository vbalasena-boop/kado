import type { Highlight } from "@/lib/highlight";

/**
 * Carte « À la une » affichée aux clients (page de jeu + carte de fidélité).
 * Reçoit le bloc DÉJÀ résolu (visibilité/expiration calculées côté serveur,
 * cf. `visibleHighlight`). Ne rend rien si `highlight` est nul.
 */
export default function HighlightCard({
  highlight,
}: {
  highlight: Highlight | null;
}) {
  if (!highlight) return null;
  const { title, text, url } = highlight;
  return (
    <div className="highlight-card">
      {title && <div className="highlight-title">📣 {title}</div>}
      {text && <p className="highlight-text">{text}</p>}
      {url && (
        <a
          className="highlight-link"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          En savoir plus →
        </a>
      )}
    </div>
  );
}
