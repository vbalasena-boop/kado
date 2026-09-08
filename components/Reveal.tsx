"use client";

// Apparition au scroll (Framer Motion / `motion`) : fade + montée quand
// l'élément entre RÉELLEMENT dans le viewport, une seule fois.
//  - `prefers-reduced-motion` → rendu statique.
//  - `data-reveal` : cible d'un <noscript> global (layout) qui force
//    l'affichage SANS JS — sécurité anti-« contenu masqué » qui, elle,
//    n'écrase PAS l'animation quand le JS tourne.
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export default function Reveal({
  children,
  className,
  y = 24,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      data-reveal=""
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.55, ease: [0.2, 0.7, 0.2, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
