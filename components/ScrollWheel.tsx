"use client";

// Roues en filigrane, fixées dans le fond de la vitrine, qui tournent au
// rythme du scroll de TOUTE la page (effet cinéma ambiant qui accompagne le
// visiteur du haut en bas). Purement décoratif : aucun impact sur la mise en
// page (fixe, sans interaction), rotation lissée par un ressort, et immobile
// sous prefers-reduced-motion.
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";

export default function ScrollWheel() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const smooth = useSpring(scrollYProgress, {
    stiffness: 60,
    damping: 22,
    restDelta: 0.0005,
  });
  // Grande roue : 2 tours sur la hauteur de la page. Petite roue : contre-
  // rotation plus lente → sensation de profondeur.
  const rotA = useTransform(smooth, [0, 1], [0, reduce ? 0 : 720]);
  const rotB = useTransform(smooth, [0, 1], [0, reduce ? 0 : -540]);

  return (
    <div className="v-scrollwheel" aria-hidden="true">
      <motion.div className="v-sw v-sw-a" style={{ rotate: rotA }}>
        <span className="v-sw-disc" />
        <span className="v-sw-hub" />
      </motion.div>
      <motion.div className="v-sw v-sw-b" style={{ rotate: rotB }}>
        <span className="v-sw-disc" />
        <span className="v-sw-hub" />
      </motion.div>
    </div>
  );
}
