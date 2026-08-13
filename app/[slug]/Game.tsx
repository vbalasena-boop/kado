"use client";

import { useEffect, useRef, useState, useCallback } from "react";

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
  instagram_url: string | null;
  review_url: string | null;
  compliance_note: string | null;
};
type Played = Record<string, { label: string; code: string }>;
type PlayType = "instagram" | "review";
type Screen = "rules" | "hub" | "spin" | "prize" | "done";

const FONT =
  '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
const TAU = Math.PI * 2;

function isNoWin(label: string) {
  return label.toLowerCase().includes("rien");
}

export default function Game({
  slug,
  name,
  logoUrl,
  prizes,
  config,
  played: initialPlayed,
}: {
  slug: string;
  name: string;
  logoUrl: string | null;
  prizes: Prize[];
  config: Config;
  played: Played;
}) {
  const bothDone =
    initialPlayed.instagram != null && initialPlayed.review != null;
  const [screen, setScreen] = useState<Screen>(bothDone ? "done" : "rules");
  const [played, setPlayed] = useState<Played>(initialPlayed);
  const [current, setCurrent] = useState<PlayType | null>(null);
  const [prize, setPrize] = useState<{
    label: string;
    emoji: string;
    code: string | null;
  } | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const confettiRef = useRef<HTMLCanvasElement | null>(null);
  const rotRef = useRef(0);

  const usedCount = (["instagram", "review"] as PlayType[]).filter(
    (k) => played[k]
  ).length;

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
      ctx.restore();
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
    if (played[kind]) return;
    setError(null);
    setCurrent(kind);
    const url = kind === "instagram" ? config.instagram_url : config.review_url;
    if (url) {
      try {
        window.open(url, "_blank", "noopener");
      } catch {
        /* ignore */
      }
    }
    rotRef.current = rotRef.current % TAU;
    setScreen("spin");
  }

  async function spin() {
    if (spinning || !current) return;
    setSpinning(true);
    setError(null);
    try {
      const res = await fetch("/api/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, playType: current }),
      });
      const data = await res.json();

      if (res.status === 409 && data.alreadyPlayed) {
        setPlayed((p) => ({
          ...p,
          [current]: { label: data.label, code: data.code },
        }));
        animateTo(indexOfLabel(data.label), () =>
          reveal({ label: data.label, emoji: emojiOfLabel(data.label), code: data.code })
        );
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
      animateTo(data.index, () =>
        reveal({ label: data.label, emoji: data.emoji, code: data.code })
      );
    } catch {
      setError("Connexion impossible. Réessayez.");
      setSpinning(false);
    }
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
    if (!isNoWin(p.label)) burst();
  }

  function afterPrize() {
    setCurrent(null);
    setScreen(usedCount >= 2 ? "done" : "hub");
  }

  const logo = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt={name} className="logo-img" />
  ) : (
    <div className="logo">{(name || "?").charAt(0).toUpperCase()}</div>
  );

  return (
    <>
      <canvas id="confetti" ref={confettiRef} />
      <div className="app">
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
                Vous avez droit à <b>2 tours de roue</b> : un pour un suivi
                Instagram, un pour un avis Google. À chaque tour, un cadeau à
                gagner.
              </p>
              <div className="rules">
                <div className="rule">
                  <div className="num">1</div>
                  <div className="txt">
                    <b>Suivez-nous</b> <span>ou laissez un avis</span>
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
                    <b>Tournez la roue</b> <span>et gagnez</span>
                  </div>
                </div>
              </div>
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
                Vos <span className="accent">2 tours</span>
              </h1>
              <p className="sub">
                Débloquez chaque tour en réalisant l'action. Chacun ne peut être
                joué qu'une fois.
              </p>
              <div className="counter">
                Tours restants : <b>{2 - usedCount}</b>&nbsp;/&nbsp;2
              </div>
              <div className="chances">
                <button
                  className={`chance insta${played.instagram ? " used" : ""}`}
                  onClick={() => startPlay("instagram")}
                  disabled={!!played.instagram}
                >
                  <div className="ic">📸</div>
                  <div className="body">
                    <div className="t">Suivre sur Instagram</div>
                    <div className="d">1 tour de roue offert</div>
                  </div>
                  <div className={`state ${played.instagram ? "done" : "todo"}`}>
                    {played.instagram ? "✓ Fait" : "Jouer"}
                  </div>
                </button>
                <button
                  className={`chance review${played.review ? " used" : ""}`}
                  onClick={() => startPlay("review")}
                  disabled={!!played.review}
                >
                  <div className="ic">★</div>
                  <div className="body">
                    <div className="t">Laisser un avis Google</div>
                    <div className="d">1 tour de roue offert</div>
                  </div>
                  <div className={`state ${played.review ? "done" : "todo"}`}>
                    {played.review ? "✓ Fait" : "Jouer"}
                  </div>
                </button>
              </div>
            </section>
          )}

          {/* SPIN */}
          {screen === "spin" && (
            <section className="screen active">
              <div className="center">
                <span className={`badge ${current}`}>
                  {current === "instagram"
                    ? "📸 Tour Instagram"
                    : "★ Tour Avis Google"}
                </span>
              </div>
              <div className="wheel-head">
                <h2>Tournez la roue&nbsp;🎡</h2>
                <p>Un seul tour... croisez les doigts&nbsp;!</p>
              </div>
              <div className="wheel-wrap">
                <div className="pointer" />
                <canvas id="wheel" ref={canvasRef} width={680} height={680} />
                <div className="hub-dot">Spin</div>
              </div>
              {error && <p className="err">{error}</p>}
              <button className="btn" onClick={spin} disabled={spinning}>
                {spinning ? "La roue tourne…" : "Tourner la roue"}
              </button>
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
                    <p>À présenter à l'équipe lors de votre prochaine visite.</p>
                    <div className="code">
                      <small>CODE</small>
                      <span>{prize.code}</span>
                    </div>
                  </>
                )}
                <p className="fine">
                  {config.compliance_note ||
                    "Le cadeau n'est pas conditionné à la note laissée."}
                </p>
                <button className="btn" onClick={afterPrize}>
                  {usedCount >= 2 ? "Voir mes gains" : "Continuer"}
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
                <p>Vos 2 tours ont été utilisés. Merci de votre soutien&nbsp;❤️</p>
                <div className="recap">
                  {(
                    [
                      ["instagram", "📸 Suivi Instagram"],
                      ["review", "★ Avis Google"],
                    ] as [PlayType, string][]
                  ).map(([k, label]) =>
                    played[k] ? (
                      <div className="row" key={k}>
                        <div className="e">
                          {emojiOfLabel(played[k].label)}
                        </div>
                        <div className="l">
                          <b>{played[k].label}</b>
                          <small>
                            {label}
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
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
