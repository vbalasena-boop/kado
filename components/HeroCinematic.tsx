"use client";

// Hero « cinématographique » (Framer Motion) — effet wahoo :
//  • lancement spectaculaire de la roue (elle surgit en tournant + rebond),
//  • parallaxe qui suit le curseur (profondeur : roue, lueur, halo),
//  • titre géant qui bascule mot par mot (flip 3D),
//  • bouton magnétique qui vient vers la souris,
//  • parallaxe au scroll (le hero dérive et s'estompe).
// Tout est désactivé proprement si prefers-reduced-motion.
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
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

// Titre découpé en mots pour la bascule 3D individuelle.
const TITLE_LEAD = ["Transformez", "vos", "clients", "en"];

export default function HeroCinematic() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  // Parallaxe au scroll : le contenu monte et s'estompe quand on descend.
  const y = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -90]);
  const opacity = useTransform(scrollYProgress, [0, 0.78], [1, reduce ? 1 : 0]);

  // --- Parallaxe curseur (profondeur) ---
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 120, damping: 18, mass: 0.4 });
  const sy = useSpring(py, { stiffness: 120, damping: 18, mass: 0.4 });
  // Chaque couche bouge à une amplitude différente => sensation de relief.
  const wheelX = useTransform(sx, (v) => v * 26);
  const wheelY = useTransform(sy, (v) => v * 26);
  const glowX = useTransform(sx, (v) => v * 48);
  const glowY = useTransform(sy, (v) => v * 48);
  const titleX = useTransform(sx, (v) => v * -10);

  function onPointer(e: React.PointerEvent<HTMLElement>) {
    if (reduce) return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  }
  function onLeave() {
    px.set(0);
    py.set(0);
  }

  // --- Bouton magnétique ---
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const magX = useSpring(mx, { stiffness: 260, damping: 16 });
  const magY = useSpring(my, { stiffness: 260, damping: 16 });
  function onMagnet(e: React.PointerEvent<HTMLAnchorElement>) {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - (r.left + r.width / 2)) * 0.35);
    my.set((e.clientY - (r.top + r.height / 2)) * 0.4);
  }
  function onMagnetLeave() {
    mx.set(0);
    my.set(0);
  }

  const container: Variants = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduce ? 0 : 0.08, delayChildren: 0.15 },
    },
  };
  const item: Variants = reduce
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 26, filter: "blur(8px)" },
        show: {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          transition: { duration: 0.8, ease: EASE },
        },
      };
  // Mot du titre : bascule verticale 3D (flip up).
  const word: Variants = reduce
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: "0.7em", rotateX: -75 },
        show: {
          opacity: 1,
          y: "0em",
          rotateX: 0,
          transition: { duration: 0.85, ease: EASE },
        },
      };

  return (
    <section
      className="v-hero"
      ref={ref}
      onPointerMove={onPointer}
      onPointerLeave={onLeave}
    >
      {/* Halo réactif au curseur, derrière tout le hero */}
      <motion.div
        className="v-hero-glow"
        aria-hidden="true"
        style={reduce ? undefined : { x: glowX, y: glowY }}
      />

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

        {/* Lancement spectaculaire : la roue surgit en tournant, avec rebond,
            puis dérive avec le curseur + lévite doucement. */}
        <motion.div
          className="v-wheel-stage"
          style={reduce ? undefined : { x: wheelX, y: wheelY }}
        >
          <motion.div
            className="v-wheel"
            aria-hidden="true"
            initial={
              reduce ? false : { scale: 0.2, rotate: -260, opacity: 0 }
            }
            animate={
              reduce
                ? undefined
                : { scale: 1, rotate: 0, opacity: 1 }
            }
            transition={
              reduce
                ? undefined
                : {
                    duration: 1.5,
                    ease: EASE,
                    delay: 0.25,
                    scale: { type: "spring", stiffness: 140, damping: 11, delay: 0.25 },
                  }
            }
          >
            <motion.span
              className="v-wheel-float"
              animate={
                reduce ? undefined : { y: [0, -9, 0], rotate: [0, 1.4, 0] }
              }
              transition={
                reduce
                  ? undefined
                  : { duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1.6 }
              }
            >
              <span className="v-wheel-disc" />
              <span className="v-wheel-pin" />
            </motion.span>
          </motion.div>
        </motion.div>

        <motion.h1 style={reduce ? undefined : { x: titleX }}>
          <motion.span className="v-title-line" variants={container}>
            {TITLE_LEAD.map((w) => (
              <span className="v-word-mask" key={w}>
                <motion.span className="v-word" variants={word}>
                  {w}
                </motion.span>
              </span>
            ))}
          </motion.span>{" "}
          <span className="v-word-mask">
            <motion.span className="v-word v-serif" variants={word}>
              avis &amp; abonnés
            </motion.span>
          </span>
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
          <motion.a
            className="v-btn primary"
            href="/login?signup=1"
            style={reduce ? undefined : { x: magX, y: magY }}
            onPointerMove={onMagnet}
            onPointerLeave={onMagnetLeave}
          >
            Créer mon compte gratuit →
          </motion.a>
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
