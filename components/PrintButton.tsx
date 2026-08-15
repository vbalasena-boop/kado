"use client";

export function PrintButton({ label = "🖨️ Imprimer l'affiche" }: { label?: string }) {
  return (
    <button type="button" className="btn" onClick={() => window.print()}>
      {label}
    </button>
  );
}
