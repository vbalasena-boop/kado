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
        <linearGradient id="kado-goldl" x1="12" y1="12" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff0c4" />
          <stop offset="1" stopColor="#ffce68" />
        </linearGradient>
      </defs>
      {/* pastille sombre */}
      <circle cx="24" cy="24" r="22" fill="#1b1035" />
      {/* corps du cadeau */}
      <rect x="14.5" y="23.5" width="19" height="12" rx="2.4" fill="url(#kado-gold)" />
      {/* couvercle */}
      <rect x="12.5" y="19" width="23" height="5.6" rx="1.8" fill="url(#kado-goldl)" />
      {/* ruban vertical */}
      <rect x="22.2" y="19" width="3.6" height="16.5" fill="#1b1035" opacity="0.85" />
      {/* nœud */}
      <path d="M24 19 L18 14.5 L19.6 19.4 Z" fill="url(#kado-gold)" />
      <path d="M24 19 L30 14.5 L28.4 19.4 Z" fill="url(#kado-gold)" />
      <circle cx="24" cy="18.6" r="2.3" fill="url(#kado-goldl)" stroke="#1b1035" strokeWidth="1.1" />
      {/* étincelle */}
      <path d="M35.5 10.5l1.1 2.8 2.8 1.1-2.8 1.1-1.1 2.8-1.1-2.8-2.8-1.1 2.8-1.1z" fill="#ffe9a8" />
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
