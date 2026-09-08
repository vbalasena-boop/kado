"use client";

// Hero « cinématographique » (Framer Motion) : entrée en cascade au chargement,
// roue en lévitation continue, et PARALLAXE au scroll (le contenu dérive vers le
// haut et s'estompe quand on descend). Respecte prefers-reduced-motion.
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type Variants,
} from "motion/react";
import { useRef } from "react";

function GoogleGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  );
}
function InstagramGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5.4" fill="none" stroke="#fff" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="#fff" strokeWidth="2" />
      <circle cx="17.3" cy="6.7" r="1.3" fill="#fff" />
    </svg>
  );
}

const EASE = [0.16, 1, 0.3, 1] as const; // « expo out » — sensation cinéma

export default function HeroCinematic() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  // Parallaxe : le contenu monte et s'estompe quand on descend.
  const y = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -80]);
  const opacity = useTransform(scrollYProgress, [0, 0.75], [1, reduce ? 1 : 0]);

  const container: Variants = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduce ? 0 : 0.09, delayChildren: 0.05 },
    },
  };
  const item: Variants = reduce
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 24, filter: "blur(6px)" },
        show: {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          transition: { duration: 0.8, ease: EASE },
        },
      };

  return (
    <section className="v-hero" ref={ref}>
      <motion.div
        className="v-hero-inner"
        style={{ y, opacity }}
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.div className="v-badge" variants={item}>
          🎁 Avis · Abonnés · Fidélité
        </motion.div>

        <motion.div
          className="v-wheel"
          aria-hidden="true"
          variants={item}
          animate={
            reduce
              ? undefined
              : { y: [0, -10, 0], rotate: [0, 1.5, 0] }
          }
          transition={
            reduce
              ? undefined
              : { duration: 6, repeat: Infinity, ease: "easeInOut" }
          }
        >
          <span className="v-wheel-disc" />
          <span className="v-wheel-pin" />
        </motion.div>

        <motion.h1 variants={item}>
          Transformez vos clients en{" "}
          <span className="v-serif">avis &amp; abonnés</span>
        </motion.h1>

        <motion.p className="v-lede" variants={item}>
          Le jeu de roue de la fortune qui booste votre réputation Google et
          votre Instagram — sans effort, à chaque visite.
        </motion.p>

        <motion.p className="v-hero-sectors" variants={item}>
          Restaurant · Coiffeur · Boutique · Boulangerie · Salle de sport…{" "}
          <b>Kado s'adapte à votre métier.</b>
        </motion.p>

        <motion.div className="v-brands" variants={item}>
          <span className="v-brand">
            <GoogleGlyph /> Plus d'avis 5★
          </span>
          <span className="v-brand insta">
            <InstagramGlyph /> Plus d'abonnés
          </span>
        </motion.div>

        <motion.div className="v-cta" variants={item}>
          <a className="v-btn primary" href="/login?signup=1">
            Créer mon compte gratuit →
          </a>
          <a className="v-btn ghost" href="/cafe-lumiere">
            🎡 Essayer la démo
          </a>
        </motion.div>

        <motion.div className="v-trust" variants={item}>
          <span>
            <b>✓</b> Sans application
          </span>
          <span>
            <b>✓</b> Installé en 2 minutes
          </span>
          <span>
            <b>✓</b> 14 jours d'essai gratuit
          </span>
        </motion.div>
      </motion.div>
    </section>
  );
}
