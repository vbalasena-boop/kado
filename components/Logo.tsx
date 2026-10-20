/**
 * Logo Kado — cadeau minimal (trait fin) + mot « kado ».
 * Le trait suit `currentColor` : lisible sur fond clair comme sur fond sombre.
 * `withText` : afficher le mot à côté du symbole.
 */
export function KadoMark({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="Kado"
    >
      <rect x="10" y="28" width="44" height="28" rx="4" stroke="currentColor" strokeWidth="4" />
      <rect x="6" y="20" width="52" height="11" rx="3" fill="currentColor" />
      <rect x="29.5" y="20" width="5" height="36" fill="#e85b3d" />
      <path
        d="M32 20 C26 6 14 8 18 16 C20 20 28 20 32 20 Z M32 20 C38 6 50 8 46 16 C44 20 36 20 32 20 Z"
        fill="#efc64f"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
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
          kado
        </span>
      )}
    </span>
  );
}
