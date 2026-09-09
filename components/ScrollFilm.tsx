"use client";

// Séquence « film » pilotée par le scroll (scrollytelling) : la scène reste
// ÉPINGLÉE plein écran (position: sticky) pendant que le visiteur fait défiler
// ~3 écrans ; la progression du scroll (0 → 1) sert de timeline et joue trois
// scènes, comme les pages produit Apple :
//   1. le client scanne le QR code,
//   2. la roue tourne… puis s'arrête,
//   3. le cadeau, l'avis Google et l'abonné Instagram.
// Bandes noires « cinéma », titre en serif italique, compteur de scènes.
// Sous prefers-reduced-motion : la grille statique des 3 étapes.
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import {
  QrCode,
  DeviceMobile,
  Gift,
  Star,
  InstagramLogo,
} from "@phosphor-icons/react/dist/ssr";

type Step = { n: string; t: string; d: string };

function Caption({ step }: { step: Step }) {
  return (
    <p className="v-film-cap">
      <span className="v-film-cap-t v-serif">{step.t}</span>
      {step.d}
    </p>
  );
}

export default function ScrollFilm({ steps }: { steps: Step[] }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress: p } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  // --- Timeline (fraction du scroll de la section) ---
  // Scène 1 : 0 → 0.34 — le téléphone/QR arrive de loin puis s'efface.
  const s1o = useTransform(p, [0, 0.04, 0.26, 0.34], [0, 1, 1, 0]);
  const s1s = useTransform(p, [0, 0.3], [0.7, 1.08]);
  const s1y = useTransform(p, [0.26, 0.34], [0, -60]);
  // Scène 2 : 0.3 → 0.68 — la roue surgit, tourne vite puis freine.
  const s2o = useTransform(p, [0.3, 0.38, 0.6, 0.68], [0, 1, 1, 0]);
  const s2s = useTransform(p, [0.3, 0.42], [0.55, 1]);
  const s2rot = useTransform(p, [0.34, 0.44, 0.54, 0.64], [0, 900, 1400, 1620]);
  // Scène 3 : 0.64 → 1 — le cadeau éclate, les gains arrivent des côtés.
  const s3o = useTransform(p, [0.64, 0.72, 1], [0, 1, 1]);
  const s3s = useTransform(p, [0.66, 0.8], [0.4, 1]);
  const pillL = useTransform(p, [0.74, 0.88], [-140, 0]);
  const pillR = useTransform(p, [0.74, 0.88], [140, 0]);
  const pillO = useTransform(p, [0.74, 0.84], [0, 1]);
  const glow = useTransform(p, [0.7, 0.85], [0, 1]);
  // Compteur de scènes (points) et respiration lente du fond.
  const d1 = useTransform(p, [0, 0.33, 0.34], [1, 1, 0.25]);
  const d2 = useTransform(p, [0.33, 0.34, 0.67, 0.68], [0.25, 1, 1, 0.25]);
  const d3 = useTransform(p, [0.67, 0.68], [0.25, 1]);
  const bgScale = useTransform(p, [0, 1], [1, 1.12]);

  if (reduce) {
    return (
      <section className="v-section">
        <h2>Comment ça marche</h2>
        <div className="v-steps">
          {steps.map((s) => (
            <div className="v-step" key={s.n}>
              <div className="v-step-n">{s.n}</div>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const [a, b, c] = steps;
  return (
    <section className="v-film" ref={ref} aria-label="Comment ça marche">
      <div className="v-film-stage">
        <motion.div className="v-film-bg" style={{ scale: bgScale }} aria-hidden="true" />

        <div className="v-film-bar top">
          <span className="v-film-title">Comment ça marche</span>
          <span className="v-film-dots" aria-hidden="true">
            <motion.i style={{ opacity: d1 }} />
            <motion.i style={{ opacity: d2 }} />
            <motion.i style={{ opacity: d3 }} />
          </span>
        </div>

        {/* Scène 1 — le client scanne */}
        <motion.div className="v-film-scene" data-scene="1" style={{ opacity: s1o, scale: s1s, y: s1y }}>
          <div className="v-film-visual v-film-scan" aria-hidden="true">
            <DeviceMobile className="ph" weight="thin" />
            <QrCode className="qr" weight="duotone" />
          </div>
          <Caption step={a} />
        </motion.div>

        {/* Scène 2 — la roue tourne */}
        <motion.div className="v-film-scene" data-scene="2" style={{ opacity: s2o, scale: s2s }}>
          <div className="v-film-visual">
            <div className="v-wheel v-film-wheel" aria-hidden="true">
              <motion.span className="v-wheel-scroll" style={{ rotate: s2rot }}>
                <span className="v-wheel-disc" />
              </motion.span>
              <span className="v-wheel-pin" />
            </div>
          </div>
          <Caption step={b} />
        </motion.div>

        {/* Scène 3 — le cadeau et les gains */}
        <motion.div className="v-film-scene" data-scene="3" style={{ opacity: s3o }}>
          <div className="v-film-visual v-film-win">
            <motion.span className="v-film-glow" style={{ opacity: glow }} aria-hidden="true" />
            <motion.span className="v-film-gift" style={{ scale: s3s }} aria-hidden="true">
              <Gift size={120} weight="fill" color="var(--gold)" />
            </motion.span>
            <motion.span className="v-film-pill" style={{ x: pillL, opacity: pillO }}>
              <Star size={16} weight="fill" /> +1 avis Google
            </motion.span>
            <motion.span className="v-film-pill insta" style={{ x: pillR, opacity: pillO }}>
              <InstagramLogo size={16} weight="bold" /> +1 abonné
            </motion.span>
          </div>
          <Caption step={c} />
        </motion.div>

        <div className="v-film-bar bottom" aria-hidden="true" />
      </div>
    </section>
  );
}
