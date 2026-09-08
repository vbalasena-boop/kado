"use client";

// Apparition au scroll (Framer Motion / `motion`) — version À SÉCURITÉ INTÉGRÉE.
// Fade + légère montée quand l'élément entre dans le viewport (une seule fois).
//  - `prefers-reduced-motion` → rendu statique, aucune animation.
//  - FILET DE SÉCURITÉ : si l'élément n'est pas vu dans les 2,5 s (scroll lent,
//    observer capricieux…), on force l'affichage. Impossible qu'une section
//    reste masquée sur une page de conversion.
// Appliqué aux GRILLES de cartes uniquement — les titres/textes restent
// visibles d'emblée (SEO + robustesse).
import { motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export default function Reveal({
  children,
  className,
  y = 22,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -12% 0px" });
  const [safety, setSafety] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSafety(true), 2500);
    return () => clearTimeout(t);
  }, []);

  if (reduce) return <div className={className}>{children}</div>;

  const shown = inView || safety;
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
