"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { labelIsLosing } from "@/lib/draw";
import { deviceHash } from "@/lib/device-hash";
import { buildTheme } from "@/lib/theme";
import { isValidEmail, autoSendCodeTarget, needsCollectStep } from "@/lib/optin";
import {
  unlockedSpinActions,
  reviewCtaHref,
  instagramHref,
  type TriggerAction,
} from "@/lib/wheel";

type Prize = {
  id: string;
  label: string;
  emoji: string;
  weight: number;
  color: string;
  position: number;
};
type Config = {
  primary_color: string;
  accent_color?: string | null;
  bg_color?: string | null;
  bg_image_url?: string | null;
  collect_email?: boolean | null;
  instagram_url: string | null;
  review_url: string | null;
  compliance_note: string | null;
  instagram_enabled?: boolean | null;
  review_enabled?: boolean | null;
  loyalty_enabled?: boolean | null;
  game_type?: string | null;
  trigger_actions?: unknown;
};

type GameType = "wheel" | "scratch" | "slot";

/** Libellés adaptés au jeu choisi par le commerçant. */
const GAME_TEXTS: Record<
  GameType,
  {
    one: string;
    two: string;
    offered: string;
    rule3: string;
    head: string;
    sub: string;
    cta: string;
    ctaBusy: string;
  }
> = {
  wheel: {
    one: "1 tour de roue",
    two: "2 tours de roue",
    offered: "1 tour de roue offert",
    rule3: "Tournez la roue",
    head: "Tournez la roue 🎡",
    sub: "Un seul tour… croisez les doigts !",
    cta: "Tourner la roue",
    ctaBusy: "La roue tourne…",
  },
  scratch: {
    one: "1 carte à gratter",
    two: "2 cartes à gratter",
    offered: "1 carte à gratter offerte",
    rule3: "Grattez votre carte",
    head: "Grattez votre carte 🎫",
    sub: "Frottez la surface avec le doigt… suspense !",
    cta: "Découvrir ma carte",
    ctaBusy: "Préparation…",
  },
  slot: {
    one: "1 partie",
    two: "2 parties",
    offered: "1 partie offerte",
    rule3: "Lancez la machine",
    head: "Lancez la machine 🎰",
    sub: "Trois rouleaux… croisez les doigts !",
    cta: "Lancer la machine",
    ctaBusy: "Ça tourne…",
  },
};

// rgba / mix / luminance / buildTheme sont partagés via lib/theme.ts (importé
// en tête de fichier) pour éviter la duplication avec la carte de fidélité.
/** Découpe une chaîne d'emojis en éléments (gère les emojis composés). */
function splitEmojis(s: string): string[] {
  const clean = (s || "").replace(/[\s,;·]+/g, "");
  if (!clean) return [];
  try {
    const seg = new (Intl as any).Segmenter("fr", { granularity: "grapheme" });
    return [...seg.segment(clean)].map((x: any) => x.segment).slice(0, 12);
  } catch {
    return Array.from(clean).slice(0, 12);
  }
}

/** Décor ambiant : emojis flottants (🍝🍅…), choisis par le commerçant.
 *  Positions tirées au montage (client uniquement). En mode `edges`, ils
 *  restent en périphérie (bords/haut/bas) pour ne jamais passer devant la
 *  roue pendant le jeu. */
function FloatingDecor({
  emojis,
  edges = false,
}: {
  emojis: string[];
  edges?: boolean;
}) {
  const [items, setItems] = useState<
    {
      e: string;
      x: number;
      y: number;
      s: number;
      d: number;
      delay: number;
      dx: number;
      rot: number;
      variant: number;
    }[]
  >([]);
  const [popped, setPopped] = useState<number | null>(null);

  useEffect(() => {
    if (emojis.length === 0) return;
    const list = [];
    const count = Math.min(12, Math.max(7, emojis.length * 2));
    for (let i = 0; i < count; i++) {
      let x: number, y: number;
      if (edges) {
        // Périphérie uniquement : gouttières gauche/droite, bandeaux haut/bas
        const zone = i % 4;
        if (zone === 0) { x = 1 + Math.random() * 5; y = 10 + Math.random() * 78; }
        else if (zone === 1) { x = 90 + Math.random() * 6; y = 10 + Math.random() * 78; }
        else if (zone === 2) { x = 6 + Math.random() * 84; y = 1 + Math.random() * 5; }
        else { x = 6 + Math.random() * 84; y = 91 + Math.random() * 5; }
      } else {
        x = 4 + Math.random() * 88; // % de la largeur
        y = 6 + Math.random() * 84; // % de la hauteur
      }
      list.push({
        e: emojis[i % emojis.length],
        x,
        y,
        s: (edges ? 18 : 22) + Math.random() * (edges ? 18 : 28), // taille px
        d: 6 + Math.random() * 6, // durée d'animation s
        delay: Math.random() * 5,
        dx: (Math.random() * 2 - 1) * (edges ? 16 : 34), // dérive horizontale px
        rot: (Math.random() * 2 - 1) * 16, // rotation deg
        variant: i % 3, // 3 trajectoires différentes
      });
    }
    setItems(list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emojis.join(""), edges]);

  if (items.length === 0) return null;
  return (
    <div className="decor" aria-hidden="true">
      {items.map((it, i) => (
        <span
          key={i}
          className={`decor-e decor-v${it.variant}${popped === i ? " burst" : ""}`}
          style={
            {
              left: `${it.x}%`,
              top: `${it.y}%`,
              fontSize: it.s,
              animationDuration: `${it.d}s`,
              animationDelay: `${it.delay}s`,
              "--dx": `${it.dx}px`,
              "--rot": `${it.rot}deg`,
            } as React.CSSProperties
          }
          onClick={() => {
            haptic(30);
            setPopped(i);
            window.setTimeout(() => setPopped(null), 600);
          }}
        >
          {it.e}
        </span>
      ))}
    </div>
  );
}

type Played = Record<string, { label: string; code: string }>;
// Un tour = une action déclenchante non-avis. L'avis (`review`) n'apparaît
// jamais ici : il ne débloque plus aucun tour.
type PlayType = TriggerAction;
type Screen = "rules" | "hub" | "collect" | "spin" | "prize" | "done";

const FONT =
  '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
const TAU = Math.PI * 2;

function isNoWin(label: string) {
  return labelIsLosing(label);
}

/** Vibration mobile (si supportée) — ignorée silencieusement sinon. */
function haptic(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* non supporté */
  }
}

function InstagramGlyph({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5.4"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
      />
      <circle
        cx="12"
        cy="12"
        r="4.2"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
      />
      <circle cx="17.3" cy="6.7" r="1.3" fill="#fff" />
    </svg>
  );
}

/**
 * Registre des actions déclenchantes (non-avis). Clés = `TRIGGER_ACTIONS` :
 * unique source de vérité pour le HUB, le badge du tour et le récap final.
 * Ajouter une action = ajouter une entrée ici (pas de bloc codé en dur ailleurs).
 *  - `url(config, slug)` : lien ouvert au clic (confiance « au clic ») ;
 *    `instagram` → `config.instagram_url`, `loyalty` → `/${slug}/fidelite`,
 *    `optin` → aucun lien.
 *  - `glyph(size)` : icône (HUB ~26px, badge 15px).
 */
type ActionMeta = {
  cls: string;
  hubTitle: string;
  badge: string;
  recap: string;
  glyph: (size?: number) => React.ReactNode;
  url: (config: Config, slug: string) => string | null;
};

const ACTIONS: Record<TriggerAction, ActionMeta> = {
  instagram: {
    cls: "insta",
    hubTitle: "Suivre sur Instagram",
    badge: "Tour Instagram",
    recap: "📸 Suivi Instagram",
    glyph: (size) => <InstagramGlyph size={size ?? 26} />,
    url: (config) => instagramHref(config),
  },
  loyalty: {
    cls: "loyalty",
    hubTitle: "Prendre la carte de fidélité",
    badge: "Tour Fidélité",
    recap: "🎟️ Carte de fidélité",
    glyph: (size) => (
      <span style={{ fontSize: size ?? 26, lineHeight: 1 }} aria-hidden="true">
        🎟️
      </span>
    ),
    url: (_config, slug) => `/${slug}/fidelite`,
  },
  optin: {
    cls: "optin",
    hubTitle: "Recevoir les offres par e-mail",
    badge: "Tour Offres",
    recap: "📧 Offres par e-mail",
    glyph: (size) => (
      <span style={{ fontSize: size ?? 26, lineHeight: 1 }} aria-hidden="true">
        📧
      </span>
    ),
    url: () => null,
  },
};

/** Carte à gratter : un voile métallisé que l'on efface au doigt. */
function ScratchCard({
  emoji,
  label,
  onDone,
}: {
  emoji: string;
  label: string;
  onDone: () => void;
}) {
  const cvRef = useRef<HTMLCanvasElement | null>(null);
  const doneRef = useRef(false);
  const movesRef = useRef(0);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const g = ctx.createLinearGradient(0, 0, cv.width, cv.height);
    g.addColorStop(0, "#c3c3cf");
    g.addColorStop(0.5, "#8e8ea0");
    g.addColorStop(1, "#c3c3cf");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cv.width, cv.height);
    // motif de pièces + consigne
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    for (let i = 0; i < 24; i++) {
      ctx.beginPath();
      ctx.arc(
        (i * 97) % cv.width,
        (i * 53) % cv.height,
        3 + (i % 4),
        0,
        TAU
      );
      ctx.fill();
    }
    ctx.fillStyle = "rgba(30,25,50,0.55)";
    ctx.font = `800 26px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("Grattez ici ✨", cv.width / 2, cv.height / 2 + 9);
  }, []);

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    haptic([0, 40, 30, 70]);
    setTimeout(onDone, 350);
  }

  function scratchAt(clientX: number, clientY: number) {
    const cv = cvRef.current;
    if (!cv || doneRef.current) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const r = cv.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * cv.width;
    const y = ((clientY - r.top) / r.height) * cv.height;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, TAU);
    ctx.fill();
    movesRef.current++;
    if (movesRef.current % 12 === 0) checkProgress();
  }

  function checkProgress() {
    const cv = cvRef.current;
    if (!cv || doneRef.current) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    try {
      const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
      const step = 14;
      let clear = 0;
      let total = 0;
      for (let y = 0; y < cv.height; y += step) {
        for (let x = 0; x < cv.width; x += step) {
          total++;
          if (data[(y * cv.width + x) * 4 + 3] < 40) clear++;
        }
      }
      if (total > 0 && clear / total > 0.45) finish();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="scratch-wrap">
      <div className="scratch-card">
        <div className="scratch-under" aria-hidden="true">
          <span className="scratch-emoji">{emoji}</span>
          <b>{label}</b>
        </div>
        <canvas
          ref={cvRef}
          width={340}
          height={210}
          className="scratch-foil"
          onPointerDown={(e) => {
            try {
              (e.target as Element).setPointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
            scratchAt(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (e.buttons > 0 || e.pressure > 0)
              scratchAt(e.clientX, e.clientY);
          }}
          onPointerUp={checkProgress}
        />
      </div>
      <button className="scratch-reveal" onClick={finish}>
        Tout révéler
      </button>
    </div>
  );
}

export default function Game({
  slug,
  name,
  logoUrl,
  prizes,
  config,
  played: initialPlayed,
  preview = false,
  orderEnabled = false,
  prizeValidityDays = 30,
  decorEmojis = "",
  drawPrize = "",
}: {
  slug: string;
  name: string;
  logoUrl: string | null;
  prizes: Prize[];
  config: Config;
  played: Played;
  preview?: boolean;
  orderEnabled?: boolean;
  prizeValidityDays?: number | null;
  decorEmojis?: string;
  drawPrize?: string;
}) {
  // Tours du jeu = actions déclenchantes non-avis configurées par le commerçant
  // (⊆ {instagram, loyalty, optin}). Lecture tolérante : `unlockedSpinActions`
  // filtre/replie sur `["instagram"]` si absent, vide ou invalide. L'avis n'est
  // jamais une action déclenchante. Gate fidélité : « loyalty » est retirée si
  // la carte est désactivée (`loyalty_enabled` falsy) → jamais de tour vers une
  // carte inaccessible.
  const enabledActions = unlockedSpinActions(config.trigger_actions, {
    loyaltyEnabled: !!config.loyalty_enabled,
  });
  const totalTurns = enabledActions.length;

  // CTA avis Google neutre (facultatif, non récompensé) : URL sûre ou null.
  const reviewHref = reviewCtaHref(config);

  // Jeu choisi par le commerçant (roue par défaut)
  const gameType: GameType =
    config.game_type === "scratch" || config.game_type === "slot"
      ? config.game_type
      : "wheel";
  const T = GAME_TEXTS[gameType];
  // Nom du tour au pluriel dérivé de GAME_TEXTS (« tours de roue », « cartes à
  // gratter », « parties ») pour libeller un nombre quelconque de chances.
  const turnNoun = T.two.replace(/^\d+\s*/, "");
  const turnsLabel = totalTurns === 1 ? T.one : `${totalTurns} ${turnNoun}`;

  const allDone =
    !preview && enabledActions.every((k) => initialPlayed[k] != null);
  const [screen, setScreen] = useState<Screen>(allDone ? "done" : "rules");
  const [played, setPlayed] = useState<Played>(initialPlayed);
  const [current, setCurrent] = useState<PlayType | null>(null);
  const [prize, setPrize] = useState<{
    label: string;
    emoji: string;
    code: string | null;
  } | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leadEmail, setLeadEmail] = useState("");
  const [leadConsent, setLeadConsent] = useState(false);
  // E-mail capté à l'étape « collect » (Offres/Fidélité) : alimente l'auto-envoi
  // du code après une victoire. Distinct du formulaire post-victoire.
  const [capturedEmail, setCapturedEmail] = useState<string | null>(null);
  // Erreur inline de l'étape « collect » (e-mail saisi mais invalide).
  const [collectError, setCollectError] = useState(false);
  // Anti-doublon : dernier code auto-envoyé, et dernier e-mail posté à /api/lead.
  const autoSentCodeRef = useRef<string | null>(null);
  const leadSentEmailRef = useRef<string | null>(null);
  const [leadSent, setLeadSent] = useState(false);
  const [leadBusy, setLeadBusy] = useState(false);
  const [prizeQr, setPrizeQr] = useState<string | null>(null);
  const [codeEmail, setCodeEmail] = useState("");
  const [codeEmailSent, setCodeEmailSent] = useState(false);
  const [codeEmailBusy, setCodeEmailBusy] = useState(false);
  // Message d'erreur inline du formulaire e-mail post-victoire (validation/envoi).
  const [prizeEmailError, setPrizeEmailError] = useState("");
  // Machine à sous : contenu des 3 rouleaux
  const [reels, setReels] = useState<string[]>(["🎁", "⭐", "🍀"]);
  // Carte à gratter : lot en attente de révélation
  const [scratchPrize, setScratchPrize] = useState<{
    label: string;
    emoji: string;
    code: string | null;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    // Nouveau lot affiché → on réinitialise le formulaire "recevoir par e-mail"
    // (pré-rempli avec l'e-mail déjà capté, s'il y en a un).
    setCodeEmailSent(false);
    setCodeEmail(capturedEmail ?? "");
    if (prize && prize.code && !isNoWin(prize.label)) {
      import("qrcode")
        .then(({ default: QRCode }) =>
          QRCode.toDataURL(prize.code as string, {
            width: 280,
            margin: 1,
            color: { dark: "#1b1035", light: "#ffffff" },
          })
        )
        .then((u) => {
          if (alive) setPrizeQr(u);
        })
        .catch(() => {});
      // Auto-envoi best-effort du code à l'e-mail capté à l'étape « collect »
      // (Offres/Fidélité). Un échec ne casse pas l'affichage du code : le
      // formulaire manuel reste masqué uniquement si l'envoi a réussi.
      const target = autoSendCodeTarget({
        capturedEmail,
        code: prize.code,
        isWin: true,
      });
      // Anti-doublon : on n'auto-envoie qu'une fois par code (rejeu / remontée).
      if (target && !preview && autoSentCodeRef.current !== prize.code) {
        autoSentCodeRef.current = prize.code;
        fetch("/api/prize-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, code: prize.code, email: target }),
        })
          .then((res) => {
            if (res.ok && alive) setCodeEmailSent(true);
          })
          .catch(() => {
            /* silencieux : l'auto-envoi est un confort, pas un blocage */
          });
      }
    } else {
      setPrizeQr(null);
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prize]);

  /**
   * Formulaire e-mail UNIQUE de l'écran de gain : une seule saisie sert à
   * l'envoi du code cadeau ET (si consentement coché) à la capture du lead —
   * au lieu de deux champs e-mail empilés. Valide l'adresse et affiche une
   * erreur inline (au lieu d'échouer en silence).
   */
  async function handlePrizeEmail(e: React.FormEvent) {
    e.preventDefault();
    const email = codeEmail.trim();
    if (!isValidEmail(email)) {
      setPrizeEmailError("Adresse e-mail invalide.");
      return;
    }
    setPrizeEmailError("");

    const wantCode = !!prize?.code && !codeEmailSent;
    const wantLead =
      config.collect_email &&
      !!prize &&
      !isNoWin(prize.label) &&
      !capturedEmail &&
      !leadSent &&
      leadConsent;

    let failed = false;
    if (wantCode) {
      setCodeEmailBusy(true);
      try {
        const res = await fetch("/api/prize-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, code: prize.code, email }),
        });
        if (res.ok) setCodeEmailSent(true);
        else failed = true;
      } catch {
        failed = true;
      } finally {
        setCodeEmailBusy(false);
      }
    }
    // Capture lead UNIQUEMENT avec consentement (RGPD). Best-effort, silencieux.
    if (wantLead) {
      setLeadBusy(true);
      try {
        const res = await fetch("/api/lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, email }),
        });
        if (res.ok) setLeadSent(true);
      } catch {
        /* capture facultative */
      } finally {
        setLeadBusy(false);
      }
    }
    if (failed) {
      setPrizeEmailError("Envoi impossible pour le moment. Réessayez.");
    }
  }

  // Récupération par empreinte : si le cookie n'a pas révélé tous les tours
  // (navigation privée / cookies vidés), on demande au serveur ce que CET
  // appareil a déjà joué, et on réaffiche cadeaux + codes.
  useEffect(() => {
    if (preview || allDone) return;
    let alive = true;
    (async () => {
      const fp = await deviceHash();
      if (!fp || !alive) return;
      try {
        const res = await fetch("/api/my-plays", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, deviceHash: fp }),
        });
        if (!res.ok || !alive) return;
        const data = (await res.json()) as { played?: Played };
        const recovered = data.played ?? {};
        if (!alive || Object.keys(recovered).length === 0) return;
        // Le cookie (initialPlayed) reste prioritaire sur l'empreinte.
        setPlayed((prev) => ({ ...recovered, ...prev }));
        if (
          enabledActions.every(
            (k) => recovered[k] != null || initialPlayed[k] != null
          )
        ) {
          setScreen((s) => (s === "rules" ? "done" : s));
        }
      } catch {
        /* silencieux : la récupération est un confort, pas un blocage */
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const confettiRef = useRef<HTMLCanvasElement | null>(null);
  const rotRef = useRef(0);

  const usedCount = enabledActions.filter((k) => played[k]).length;

  // ---------- Wheel drawing ----------
  const draw = useCallback(
    (rot: number) => {
      const cv = canvasRef.current;
      if (!cv || prizes.length === 0) return;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      const R = cv.width / 2;
      const seg = TAU / prizes.length;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.save();
      ctx.translate(R, R);
      ctx.rotate(rot);
      prizes.forEach((p, i) => {
        const a0 = i * seg;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, R - 6, a0, a0 + seg);
        ctx.closePath();
        ctx.fillStyle = p.color || "#ff5d73";
        ctx.fill();
        ctx.strokeStyle = "rgba(21,12,41,.55)";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.save();
        ctx.rotate(a0 + seg / 2);
        ctx.textAlign = "right";
        ctx.fillStyle = "#150c29";
        ctx.font = `700 27px ${FONT}`;
        ctx.fillText(p.emoji || "🎁", R - 30, -6);
        ctx.font = `800 20px ${FONT}`;
        const l =
          p.label.length > 13 ? p.label.slice(0, 12) + "…" : p.label;
        ctx.fillText(l, R - 30, 20);
        ctx.restore();
      });
      // petites lumières sur le pourtour (tournent avec la roue)
      for (let i = 0; i < prizes.length; i++) {
        const a = i * seg;
        const x = Math.cos(a) * (R - 15);
        const y = Math.sin(a) * (R - 15);
        ctx.beginPath();
        ctx.arc(x, y, 3.4, 0, TAU);
        ctx.fillStyle = "rgba(255,248,230,0.92)";
        ctx.fill();
      }
      ctx.restore();

      // brillance fixe (effet vernis) + assombrissement du bord
      const gloss = ctx.createRadialGradient(
        R,
        R * 0.72,
        R * 0.1,
        R,
        R,
        R
      );
      gloss.addColorStop(0, "rgba(255,255,255,0.18)");
      gloss.addColorStop(0.55, "rgba(255,255,255,0.04)");
      gloss.addColorStop(1, "rgba(0,0,0,0.16)");
      ctx.beginPath();
      ctx.arc(R, R, R - 6, 0, TAU);
      ctx.fillStyle = gloss;
      ctx.fill();
    },
    [prizes]
  );

  useEffect(() => {
    draw(rotRef.current);
  }, [draw, screen]);

  // ---------- Confetti ----------
  const burst = useCallback(() => {
    if (matchMedia("(prefers-reduced-motion:reduce)").matches) return;
    const cc = confettiRef.current;
    if (!cc) return;
    cc.width = window.innerWidth;
    cc.height = window.innerHeight;
    const cx = cc.getContext("2d");
    if (!cx) return;
    const cols = ["#ffc24d", "#ff5d73", "#39d98a", "#8b6cff", "#4fc3f7", "#fdf4e3"];
    let parts = Array.from({ length: 160 }, (_, i) => ({
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 14,
      vy: Math.random() * -15 - 4,
      g: 0.35 + Math.random() * 0.2,
      size: 6 + Math.random() * 7,
      col: cols[i % cols.length],
      rot: Math.random() * TAU,
      vr: (Math.random() - 0.5) * 0.4,
      life: 1,
    }));
    const anim = () => {
      cx.clearRect(0, 0, cc.width, cc.height);
      parts.forEach((p) => {
        p.vy += p.g;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= 0.006;
        cx.save();
        cx.translate(p.x, p.y);
        cx.rotate(p.rot);
        cx.globalAlpha = Math.max(p.life, 0);
        cx.fillStyle = p.col;
        cx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        cx.restore();
      });
      parts = parts.filter((p) => p.life > 0 && p.y < cc.height + 40);
      if (parts.length) requestAnimationFrame(anim);
      else cx.clearRect(0, 0, cc.width, cc.height);
    };
    requestAnimationFrame(anim);
  }, []);

  // ---------- Flow ----------
  function startPlay(kind: PlayType) {
    if (!preview && played[kind]) return;
    setError(null);
    setCurrent(kind);
    // Offres / Fidélité : on propose d'abord de laisser un e-mail (facultatif)
    // avant de débloquer le tour. Pas d'ouverture de lien ici.
    if (needsCollectStep(kind)) {
      setCollectError(false);
      setScreen("collect");
      return;
    }
    // Instagram : comportement inchangé — ouverture du lien puis tour.
    // En mode test, on n'ouvre pas les liens de l'action.
    if (!preview) {
      const url = ACTIONS[kind].url(config, slug);
      if (url) {
        try {
          window.open(url, "_blank", "noopener");
        } catch {
          /* ignore */
        }
      }
    }
    rotRef.current = rotRef.current % TAU;
    setScreen("spin");
  }

  /** Étape « collect » : le joueur continue avec ou sans e-mail. Si un e-mail
   *  valide est fourni (hors preview) → enregistrement best-effort du lead +
   *  mémorisation pour l'auto-envoi du code. Le tour se débloque dans tous les
   *  cas. */
  function continueFromCollect(e: React.FormEvent) {
    e.preventDefault();
    const email = leadEmail.trim();
    // E-mail saisi mais invalide → on ne perd pas l'intention en silence.
    if (email && !isValidEmail(email)) {
      setCollectError(true);
      return;
    }
    setCollectError(false);
    if (!preview && isValidEmail(email)) {
      setCapturedEmail(email);
      // Best-effort, calqué sur submitLead ; anti-doublon si la même adresse a
      // déjà été enregistrée (cas de deux actions collectrices dans un tour).
      if (leadSentEmailRef.current !== email) {
        leadSentEmailRef.current = email;
        fetch("/api/lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, email }),
        }).catch(() => {
          /* silencieux : la capture est facultative */
        });
      }
    }
    rotRef.current = rotRef.current % TAU;
    setScreen("spin");
  }

  /** Tirage pondéré côté client (utilisé uniquement en mode test). */
  function previewPick(): number {
    const total = prizes.reduce((s, p) => s + Math.max(0, p.weight), 0);
    if (total <= 0) return Math.floor(Math.random() * prizes.length);
    let r = Math.random() * total;
    for (let i = 0; i < prizes.length; i++) {
      r -= Math.max(0, prizes[i].weight);
      if (r < 0) return i;
    }
    return prizes.length - 1;
  }

  async function spin() {
    if (spinning || !current) return;
    setSpinning(true);
    setError(null);
    haptic(20);

    // Mode test : tirage local, illimité, rien n'est enregistré.
    if (preview) {
      const idx = previewPick();
      const p = prizes[idx];
      animate(idx, { label: p.label, emoji: p.emoji, code: null });
      return;
    }

    try {
      // Empreinte d'appareil : verrou secondaire qui survit à la navigation
      // privée / au vidage des cookies (voir lib/device-hash.ts).
      const fp = await deviceHash();
      const res = await fetch("/api/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, playType: current, deviceHash: fp }),
      });
      const data = await res.json();

      if (res.status === 409 && data.alreadyPlayed) {
        setPlayed((p) => ({
          ...p,
          [current]: { label: data.label, code: data.code },
        }));
        animate(indexOfLabel(data.label), {
          label: data.label,
          emoji: emojiOfLabel(data.label),
          code: data.code,
        });
        return;
      }
      if (!res.ok) {
        setError("Le jeu est indisponible pour le moment.");
        setSpinning(false);
        return;
      }

      setPlayed((p) => ({
        ...p,
        [current]: { label: data.label, code: data.code },
      }));
      animate(data.index, {
        label: data.label,
        emoji: data.emoji,
        code: data.code,
      });
    } catch {
      setError("Connexion impossible. Réessayez.");
      setSpinning(false);
    }
  }

  /** Lance l'animation du jeu choisi, puis révèle le lot. */
  function animate(
    idx: number,
    p: { label: string; emoji: string; code: string | null }
  ) {
    if (gameType === "scratch") {
      // La carte s'affiche : c'est le grattage qui révélera le lot.
      setSpinning(false);
      setScratchPrize(p);
      return;
    }
    if (gameType === "slot") {
      animateSlot(idx, () => reveal(p));
      return;
    }
    animateTo(idx, () => reveal(p));
  }

  /** Machine à sous : 3 rouleaux qui s'arrêtent l'un après l'autre. */
  function animateSlot(idx: number, done: () => void) {
    const target = prizes[idx]?.emoji || "🎁";
    const pool = prizes.map((p) => p.emoji || "🎁");
    const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
    if (reduce) {
      setReels([target, target, target]);
      setSpinning(false);
      setTimeout(done, 300);
      return;
    }
    const stopped = [false, false, false];
    const iv = window.setInterval(() => {
      setReels((r) =>
        r.map((v, i) =>
          stopped[i] ? v : pool[Math.floor(Math.random() * pool.length)]
        )
      );
    }, 80);
    [900, 1550, 2200].forEach((t, i) => {
      window.setTimeout(() => {
        stopped[i] = true;
        setReels((r) => {
          const n = [...r];
          n[i] = target;
          return n;
        });
        haptic(15);
        if (i === 2) {
          window.clearInterval(iv);
          setSpinning(false);
          window.setTimeout(done, 500);
        }
      }, t);
    });
  }

  function indexOfLabel(label: string) {
    const i = prizes.findIndex((p) => p.label === label);
    return i < 0 ? 0 : i;
  }
  function emojiOfLabel(label: string) {
    return prizes.find((p) => p.label === label)?.emoji ?? "🎁";
  }

  function animateTo(idx: number, done: () => void) {
    const seg = TAU / prizes.length;
    const segCenter = idx * seg + seg / 2;
    const target = -Math.PI / 2 - segCenter;
    const turns = 5 + Math.floor(Math.random() * 2);
    const from = rotRef.current % TAU;
    const to = turns * TAU + target;
    const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
    if (reduce) {
      rotRef.current = to;
      draw(to);
      setTimeout(done, 300);
      return;
    }
    const dur = 4200;
    const t0 = performance.now();
    const frame = (now: number) => {
      const p = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      rotRef.current = from + (to - from) * e;
      draw(rotRef.current);
      if (p < 1) requestAnimationFrame(frame);
      else {
        rotRef.current = to;
        setSpinning(false);
        setTimeout(done, 450);
      }
    };
    requestAnimationFrame(frame);
  }

  function reveal(p: { label: string; emoji: string; code: string | null }) {
    setPrize(p);
    setScreen("prize");
    if (!isNoWin(p.label)) {
      burst();
      haptic([0, 60, 40, 90]);
    }
  }

  function afterPrize() {
    setCurrent(null);
    setScratchPrize(null);
    setReels(["🎁", "⭐", "🍀"]);
    if (preview) {
      setPlayed({}); // en test, on peut rejouer indéfiniment
      setScreen("hub");
      return;
    }
    setScreen(usedCount >= totalTurns ? "done" : "hub");
  }

  const [logoSpin, setLogoSpin] = useState(false);
  function pokeLogo() {
    haptic(25);
    setLogoSpin(true);
    window.setTimeout(() => setLogoSpin(false), 750);
  }
  const logo = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt={name}
      width={46}
      height={46}
      decoding="async"
      className={`logo-img logo-anim${logoSpin ? " poke" : ""}`}
      onClick={pokeLogo}
    />
  ) : (
    <div
      className={`logo logo-anim${logoSpin ? " poke" : ""}`}
      onClick={pokeLogo}
    >
      {(name || "?").charAt(0).toUpperCase()}
    </div>
  );

  const themeCss = buildTheme(
    config.primary_color || "#ffc24d",
    config.accent_color || "#ff5d73",
    config.bg_color || "#150c29",
    config.bg_image_url
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      <canvas id="confetti" ref={confettiRef} />
      {/* Décor animé : plein écran à l'accueil, puis en périphérie pendant
          le jeu — jamais devant la roue. */}
      <FloatingDecor
        emojis={splitEmojis(decorEmojis)}
        edges={screen !== "rules"}
      />
      <div className="app">
        {preview && (
          <div className="preview-banner">
            🧪 Mode test — illimité, rien n'est enregistré
          </div>
        )}
        <div className="card">
          <div className="brand">
            {logo}
            <div>
              <div className="name">{name}</div>
              <div className="tag">Jeu · Récompense</div>
            </div>
          </div>

          {/* RULES */}
          {screen === "rules" && (
            <section className="screen active">
              <h1>
                Scannez, jouez,<br />
                <span className="accent">régalez-vous&nbsp;!</span>
              </h1>
              <p className="sub">
                {totalTurns > 1 ? (
                  <>
                    Vous avez droit à <b>{turnsLabel}</b> : une chance par action
                    réalisée. À chaque fois, un cadeau à gagner.
                  </>
                ) : (
                  <>
                    Vous avez droit à <b>{T.one}</b> pour l'action proposée. Un
                    cadeau à gagner&nbsp;!
                  </>
                )}
              </p>
              <div className="rules">
                <div className="rule">
                  <div className="num">1</div>
                  <div className="txt">
                    {totalTurns > 1 ? (
                      <b>Réalisez les actions proposées</b>
                    ) : (
                      <b>Réalisez l'action proposée</b>
                    )}
                  </div>
                </div>
                <div className="rule">
                  <div className="num">2</div>
                  <div className="txt">
                    <b>Revenez sur cette page</b>
                  </div>
                </div>
                <div className="rule">
                  <div className="num">3</div>
                  <div className="txt">
                    <b>{T.rule3}</b> <span>et gagnez</span>
                  </div>
                </div>
              </div>
              {drawPrize && (
                <div className="draw-note">
                  🎲 Bonus : tentez aussi de gagner <b>{drawPrize}</b> au tirage
                  au sort en laissant votre e-mail&nbsp;!
                </div>
              )}
              <button className="btn" onClick={() => setScreen("hub")}>
                C'est parti&nbsp;→
              </button>
              <div className="dots">
                <i className="on" />
                <i />
                <i />
              </div>
            </section>
          )}

          {/* HUB */}
          {screen === "hub" && (
            <section className="screen active">
              <h1>
                {totalTurns > 1 ? (
                  <>
                    Vos <span className="accent">{totalTurns} chances</span>
                  </>
                ) : (
                  <>
                    Votre <span className="accent">chance</span>
                  </>
                )}
              </h1>
              <p className="sub">
                {totalTurns > 1
                  ? "Débloquez chaque chance en réalisant l'action. Chacune ne peut être jouée qu'une fois."
                  : `Réalisez l'action pour débloquer ${T.one}.`}
              </p>
              <div className="counter">
                Chances restantes : <b>{totalTurns - usedCount}</b>
                &nbsp;/&nbsp;{totalTurns}
              </div>
              <div className="chances">
                {enabledActions.map((k) => {
                  const a = ACTIONS[k];
                  const done = !!played[k];
                  return (
                    <button
                      key={k}
                      className={`chance ${a.cls}${done ? " used" : ""}`}
                      onClick={() => startPlay(k)}
                      disabled={done}
                    >
                      <div className="ic">{a.glyph()}</div>
                      <div className="body">
                        <div className="t">{a.hubTitle}</div>
                        <div className="d">{T.offered}</div>
                      </div>
                      <div className={`state ${done ? "done" : "todo"}`}>
                        {done ? "✓ Fait" : "Jouer"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* COLLECT — étape e-mail facultative (Offres / Fidélité) */}
          {screen === "collect" && (
            <section className="screen active">
              <div className="center">
                <span className={`badge ${current ?? ""}`}>
                  {current && (
                    <>
                      {ACTIONS[current].glyph(15)} {ACTIONS[current].badge}
                    </>
                  )}
                </span>
              </div>
              <div className="wheel-head">
                <h2>📧 Laissez votre e-mail</h2>
                <p>
                  Facultatif —{" "}
                  {current === "loyalty"
                    ? "pour votre carte de fidélité"
                    : "pour recevoir vos offres"}
                  . Vous pouvez continuer sans le renseigner.
                </p>
              </div>
              <form className="lead-form" onSubmit={continueFromCollect}>
                <label className="lead-label" htmlFor="collect-email">
                  Votre e-mail (facultatif)
                </label>
                <div className="lead-row">
                  <input
                    id="collect-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="votre@email.fr"
                    value={leadEmail}
                    onChange={(e) => {
                      setLeadEmail(e.target.value);
                      if (collectError) setCollectError(false);
                    }}
                  />
                </div>
                {collectError && (
                  <span className="onboarding-err">
                    Adresse e-mail invalide. Corrigez-la ou laissez le champ vide
                    pour continuer.
                  </span>
                )}
                <button className="btn" type="submit">
                  Continuer&nbsp;→
                </button>
              </form>
              <button
                type="button"
                onClick={() => setScreen("hub")}
                style={{
                  background: "none",
                  border: "none",
                  color: "inherit",
                  opacity: 0.7,
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: "8px",
                  font: "inherit",
                }}
              >
                ← Retour
              </button>
              <p className="fine">
                En continuant avec votre e-mail, vous acceptez de recevoir les
                offres de ce commerce. {config.compliance_note ||
                  "Le cadeau n'est pas conditionné à la note laissée."}
              </p>
            </section>
          )}

          {/* SPIN */}
          {screen === "spin" && (
            <section className="screen active">
              <div className="center">
                <span className={`badge ${current ?? ""}`}>
                  {current && (
                    <>
                      {ACTIONS[current].glyph(15)} {ACTIONS[current].badge}
                    </>
                  )}
                </span>
              </div>
              <div className="wheel-head">
                <h2>{T.head}</h2>
                <p>{T.sub}</p>
              </div>

              {gameType === "wheel" && (
                <div className="wheel-wrap">
                  <div className="pointer" />
                  <canvas id="wheel" ref={canvasRef} width={680} height={680} />
                  <div className="hub-dot">Spin</div>
                </div>
              )}

              {gameType === "slot" && (
                <div className="slot-machine">
                  <div className="slot-window">
                    {reels.map((e, i) => (
                      <div
                        key={i}
                        className={`slot-reel${spinning ? " spin" : ""}`}
                      >
                        {e}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {gameType === "scratch" &&
                (scratchPrize ? (
                  <ScratchCard
                    emoji={scratchPrize.emoji}
                    label={scratchPrize.label}
                    onDone={() => reveal(scratchPrize)}
                  />
                ) : (
                  <div className="scratch-placeholder" aria-hidden="true">
                    🎫
                  </div>
                ))}

              {error && <p className="err">{error}</p>}

              {gameType === "scratch" && scratchPrize ? (
                <p className="scratch-hint">
                  👆 Frottez la carte avec votre doigt
                </p>
              ) : (
                <button
                  className="btn spin-cta"
                  onClick={spin}
                  disabled={spinning}
                >
                  {spinning ? T.ctaBusy : T.cta}
                </button>
              )}
            </section>
          )}

          {/* PRIZE */}
          {screen === "prize" && prize && (
            <section className="screen active">
              <div className="prize">
                <span className="emoji">{prize.emoji}</span>
                {isNoWin(prize.label) ? (
                  <>
                    <div className="win nowin">Pas de chance…</div>
                    <h2>{prize.label}</h2>
                    <p>
                      Ce n'était pas le bon tour ! Il vous reste peut-être une
                      autre chance. 🙂
                    </p>
                  </>
                ) : (
                  <>
                    <div className="win">Bravo, vous avez gagné</div>
                    <h2>{prize.label}</h2>
                    <p>
                      À présenter à l'équipe lors de votre prochaine visite.
                      {prizeValidityDays != null && (
                        <>
                          {" "}
                          Valable <b>{prizeValidityDays} jours</b> — jusqu'au{" "}
                          {new Date(
                            Date.now() + prizeValidityDays * 864e5
                          ).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "long",
                          })}
                          .
                        </>
                      )}
                    </p>
                    <div className="code">
                      <small>CODE</small>
                      <span>{prize.code}</span>
                    </div>
                    {prizeQr && (
                      // eslint-disable-next-line @next/next/no-img-element -- data URI (QR généré), pas d'optimisation next/image utile
                      <img
                        src={prizeQr}
                        alt="QR du code cadeau"
                        className="prize-qr"
                      />
                    )}
                  </>
                )}
                {/* Formulaire e-mail UNIQUE (fusion « recevoir mon code » +
                    « recevez nos offres ») : un seul champ, pas de double saisie.
                    S'affiche tant qu'il reste quelque chose à faire (envoyer le
                    code et/ou capturer le lead), sinon confirmations. */}
                {!preview &&
                  (() => {
                    const wantCode = !!prize?.code && !codeEmailSent;
                    const wantLead =
                      config.collect_email &&
                      !isNoWin(prize.label) &&
                      !capturedEmail &&
                      !leadSent;
                    if (!wantCode && !wantLead) {
                      return (
                        <>
                          {codeEmailSent && (
                            <p className="lead-ok">
                              ✅ Code envoyé par e-mail&nbsp;!
                            </p>
                          )}
                          {leadSent && (
                            <p className="lead-ok">✅ Merci, à bientôt&nbsp;!</p>
                          )}
                        </>
                      );
                    }
                    return (
                      <form className="lead-form" onSubmit={handlePrizeEmail}>
                        <label className="lead-label">
                          {wantCode && wantLead
                            ? "📧 Recevez votre code + nos offres par e-mail"
                            : wantCode
                              ? "📧 Recevoir mon code par e-mail (pour ne pas le perdre)"
                              : drawPrize
                                ? `🎲 Laissez votre e-mail et participez au tirage : ${drawPrize} à gagner !`
                                : "📧 Recevez nos offres par e-mail (facultatif)"}
                        </label>
                        <div className="lead-row">
                          <input
                            type="email"
                            inputMode="email"
                            placeholder="votre@email.fr"
                            value={codeEmail}
                            onChange={(e) => {
                              setCodeEmail(e.target.value);
                              if (prizeEmailError) setPrizeEmailError("");
                            }}
                          />
                          <button
                            className="btn"
                            type="submit"
                            disabled={codeEmailBusy || leadBusy}
                          >
                            Envoyer
                          </button>
                        </div>
                        {wantLead && (
                          <label className="lead-consent">
                            <input
                              type="checkbox"
                              checked={leadConsent}
                              onChange={(e) => setLeadConsent(e.target.checked)}
                            />
                            <span>
                              J'accepte de recevoir des offres de ce commerce.
                            </span>
                          </label>
                        )}
                        {prizeEmailError && (
                          <p className="onboarding-err">{prizeEmailError}</p>
                        )}
                      </form>
                    );
                  })()}
                <p className="fine">
                  {config.compliance_note ||
                    "Le cadeau n'est pas conditionné à la note laissée."}
                </p>
                <button className="btn" onClick={afterPrize}>
                  {usedCount >= totalTurns ? "Voir mes gains" : "Continuer"}
                </button>
              </div>
            </section>
          )}

          {/* DONE */}
          {screen === "done" && (
            <section className="screen active">
              <div className="done-screen">
                <div className="big">🎉</div>
                <h2>Vous avez tout joué&nbsp;!</h2>
                <p>
                  {totalTurns > 1
                    ? `Vos ${totalTurns} chances ont été utilisées.`
                    : "Votre chance a été utilisée."}{" "}
                  Merci de votre soutien&nbsp;❤️
                </p>
                <div className="recap">
                  {enabledActions.map((k) =>
                    played[k] ? (
                      <div className="row" key={k}>
                        <div className="e">
                          {emojiOfLabel(played[k].label)}
                        </div>
                        <div className="l">
                          <b>{played[k].label}</b>
                          <small>
                            {ACTIONS[k].recap}
                            {played[k].code ? ` · code ${played[k].code}` : ""}
                          </small>
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
                <p className="fine">
                  Présentez vos codes en caisse. À très vite&nbsp;!
                </p>
                {!preview && (
                  <a
                    className="merchant-loop-cta"
                    href={`/tarifs?parrain=${encodeURIComponent(slug)}`}
                    target="_blank"
                    rel="noopener"
                  >
                    🎁 Vous êtes commerçant&nbsp;? Offrez ça à vos clients —
                    14&nbsp;jours offerts →
                  </a>
                )}
              </div>
            </section>
          )}
        </div>
        {config.loyalty_enabled && (
          <a className="fid-link" href={`/${slug}/fidelite`}>
            🎟️ Ma carte de fidélité
          </a>
        )}
        {reviewHref && (
          <a
            className="review-cta"
            href={reviewHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Laisser un avis Google — facultatif, sans incidence sur vos cadeaux"
          >
            <span className="rc-main">
              <span aria-hidden="true">★ </span>Laisser un avis Google
            </span>
            <span className="rc-sub">
              Facultatif — sans incidence sur vos cadeaux
            </span>
          </a>
        )}
        {orderEnabled && (
          <a className="game-order-cta" href={`/${slug}/commander`}>
            <span className="goc-main">🛒 Commander en ligne</span>
            <span className="goc-sub">Retrait &amp; paiement sur place</span>
          </a>
        )}
        <footer className="game-footer">
          <a href="/legal/reglement" target="_blank" rel="noopener">
            Règlement du jeu
          </a>
          <span>·</span>
          <a href="/legal/confidentialite" target="_blank" rel="noopener">
            Confidentialité
          </a>
        </footer>
      </div>
    </>
  );
}
