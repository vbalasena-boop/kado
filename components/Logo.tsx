/**
 * Logo Kado — roue-cadeau stylisée + mot « Kado ».
 * `withText` : afficher le mot à côté du symbole.
 */
export function KadoMark({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="Kado"
    >
      <defs>
        <linearGradient id="kado-gold" x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffd36b" />
          <stop offset="1" stopColor="#f0a52e" />
        </linearGradient>
      </defs>
      {/* pastille sombre */}
      <circle cx="24" cy="24" r="22" fill="#1b1035" />
      {/* quartiers de la roue */}
      <path d="M24 24V6A18 18 0 0 1 42 24Z" fill="#ff5d73" />
      <path d="M24 24H42A18 18 0 0 1 24 42Z" fill="#ffc24d" />
      <path d="M24 24V42A18 18 0 0 1 6 24Z" fill="#39d98a" />
      <path d="M24 24H6A18 18 0 0 1 24 6Z" fill="#8b6cff" />
      {/* séparateurs */}
      <path d="M24 6V42M6 24H42" stroke="#1b1035" strokeWidth="1.6" opacity="0.5" />
      {/* moyeu doré */}
      <circle cx="24" cy="24" r="6.6" fill="url(#kado-gold)" stroke="#1b1035" strokeWidth="2.5" />
      {/* pointeur */}
      <path d="M24 1.5L28 8H20Z" fill="url(#kado-gold)" />
    </svg>
  );
}

export function Logo({
  size = 34,
  withText = true,
}: {
  size?: number;
  withText?: boolean;
}) {
  return (
    <span className="kado-logo">
      <KadoMark size={size} />
      {withText && (
        <span
          className="kado-logo-text"
          style={{ fontSize: Math.round(size * 0.62) }}
        >
          Kado
        </span>
      )}
    </span>
  );
}
