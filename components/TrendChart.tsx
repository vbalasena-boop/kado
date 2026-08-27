import type { DayCount } from "@/lib/trend";

/**
 * Mini graphique d'activité (barres journalières) — SVG pur, sans dépendance.
 * Une seule série → pas de légende (le titre nomme la donnée). Tooltip natif
 * par barre (<title>), grille discrète, barres fines à sommet arrondi.
 */
export default function TrendChart({
  series,
  label = "tours",
}: {
  series: DayCount[];
  label?: string;
}) {
  const max = series.reduce((m, d) => Math.max(m, d.count), 0);
  const total = series.reduce((s, d) => s + d.count, 0);

  if (total === 0) {
    return (
      <p className="trend-empty muted">
        Pas encore d'activité sur la période — les tours joués apparaîtront ici.
      </p>
    );
  }

  // Géométrie (coordonnées SVG ; le conteneur gère la taille réelle).
  const W = 720;
  const H = 160;
  const padL = 8;
  const padR = 8;
  const padT = 12;
  const padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = series.length;
  const slot = plotW / n;
  const barW = Math.max(3, Math.min(18, slot - 2)); // fines, 2px d'écart mini
  const baseY = padT + plotH;

  const fr = (v: string) =>
    new Date(v + "T00:00:00Z").toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    });

  // 3 repères de date : premier, milieu, dernier.
  const ticks = [0, Math.floor(n / 2), n - 1];

  return (
    <div className="trend-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Activité par jour sur ${n} jours, ${total} ${label} au total, maximum ${max} en une journée.`}
      >
        {/* Ligne de base + repère du maximum (grille discrète). */}
        <line
          x1={padL}
          y1={baseY}
          x2={W - padR}
          y2={baseY}
          className="trend-axis"
        />
        <line
          x1={padL}
          y1={padT}
          x2={W - padR}
          y2={padT}
          className="trend-grid"
        />
        <text x={padL} y={padT - 3} className="trend-gridlabel">
          {max}
        </text>

        {series.map((d, i) => {
          const h = max > 0 ? (d.count / max) * plotH : 0;
          const x = padL + i * slot + (slot - barW) / 2;
          const y = baseY - h;
          return (
            <rect
              key={d.date}
              x={x}
              y={y}
              width={barW}
              height={Math.max(0, h)}
              rx={2}
              className="trend-bar"
            >
              <title>{`${fr(d.date)} : ${d.count} ${label}`}</title>
            </rect>
          );
        })}

        {ticks.map((i) => (
          <text
            key={i}
            x={padL + i * slot + slot / 2}
            y={H - 6}
            className="trend-tick"
            textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
          >
            {fr(series[i].date)}
          </text>
        ))}
      </svg>
    </div>
  );
}
