"use client";

// Composant style « Motion-Primitives » (copy-in) : révélation de texte par
// fragments (caractères ou mots) avec effet en cascade. Adapté à Kado :
// respecte `prefers-reduced-motion` (rendu immédiat, sans animation).
// https://motion-primitives.com/docs/text-effect
import { motion, useReducedMotion, type Variants } from "motion/react";
import { Fragment } from "react";

type PresetKey = "blur" | "fade" | "slide" | "scale";

const PRESETS: Record<PresetKey, { hidden: Variants["hidden"]; visible: Variants["visible"] }> = {
  blur: {
    hidden: { opacity: 0, filter: "blur(8px)", y: 6 },
    visible: { opacity: 1, filter: "blur(0px)", y: 0 },
  },
  fade: { hidden: { opacity: 0 }, visible: { opacity: 1 } },
  slide: { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } },
  scale: { hidden: { opacity: 0, scale: 0.7 }, visible: { opacity: 1, scale: 1 } },
};

export function TextEffect({
  children,
  as: Tag = "span",
  per = "char",
  preset = "blur",
  delay = 0,
  stagger = 0.03,
  className,
}: {
  children: string;
  as?: "span" | "div" | "h1" | "h2" | "h3" | "p";
  per?: "char" | "word";
  preset?: PresetKey;
  delay?: number;
  stagger?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion[Tag] as typeof motion.span;

  // Reduced-motion : on affiche le texte tel quel, sans fragmenter ni animer.
  if (reduce) {
    return <Tag className={className}>{children}</Tag>;
  }

  const p = PRESETS[preset];
  const units =
    per === "word" ? children.split(/(\s+)/) : Array.from(children);

  return (
    <MotionTag
      className={className}
      initial="hidden"
      animate="visible"
      aria-label={children}
      transition={{ staggerChildren: stagger, delayChildren: delay }}
    >
      {units.map((u, i) => (
        <Fragment key={i}>
          {u === " " || /^\s+$/.test(u) ? (
            u
          ) : (
            <motion.span
              aria-hidden="true"
              style={{ display: "inline-block", willChange: "transform, filter, opacity" }}
              variants={{ hidden: p.hidden, visible: p.visible }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
            >
              {u}
            </motion.span>
          )}
        </Fragment>
      ))}
    </MotionTag>
  );
}
