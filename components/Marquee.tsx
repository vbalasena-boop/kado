"use client";

// Bandeau défilant infini (façon Hyliox). Boucle CSS (GPU), pause au survol,
// désactivée sous prefers-reduced-motion. Le contenu est dupliqué pour un
// raccord sans couture.
export default function Marquee({ items }: { items: string[] }) {
  const seq = [...items, ...items];
  return (
    <div className="v-marquee" aria-hidden="true">
      <div className="v-marquee-track">
        {seq.map((t, i) => (
          <span className="v-marquee-item" key={i}>
            {t}
            <i className="v-marquee-dot">✦</i>
          </span>
        ))}
      </div>
    </div>
  );
}
