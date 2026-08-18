"use client";

import { useEffect, useRef, useState } from "react";
import HomeWheel from "./HomeWheel";

const PRIZES = [
  { emoji: "🎁", label: "Cadeau surprise" },
  { emoji: "☕", label: "Café offert" },
  { emoji: "🍰", label: "Dessert offert" },
  { emoji: "🏷️", label: "-10 % sur l'addition" },
  { emoji: "🍹", label: "Boisson offerte" },
];

/* ── Carte à gratter jouable ─────────────────────────────── */
function HomeScratch() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [prize, setPrize] = useState(PRIZES[0]);
  const [revealed, setRevealed] = useState(false);
  const movesRef = useRef(0);

  function paintFoil() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = "source-over";
    const g = ctx.createLinearGradient(0, 0, c.width, c.height);
    g.addColorStop(0, "#a9763f");
    g.addColorStop(0.5, "#c98a4b");
    g.addColorStop(1, "#a9763f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "700 15px Arial";
    ctx.textAlign = "center";
    ctx.fillText("✨ Grattez ici ✨", c.width / 2, c.height / 2 + 5);
  }

  function reset() {
    setPrize(PRIZES[Math.floor(Math.random() * PRIZES.length)]);
    setRevealed(false);
    movesRef.current = 0;
    requestAnimationFrame(paintFoil);
  }

  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function scratch(e: React.PointerEvent<HTMLCanvasElement>) {
    if (revealed) return;
    if (e.buttons !== 1 && e.pointerType === "mouse") return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * c.width;
    const y = ((e.clientY - r.top) / r.height) * c.height;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.fill();
    movesRef.current++;
    if (movesRef.current % 10 === 0) {
      const img = ctx.getImageData(0, 0, c.width, c.height).data;
      let clear = 0;
      for (let i = 3; i < img.length; i += 40) if (img[i] === 0) clear++;
      if (clear / (img.length / 40) > 0.45) {
        ctx.clearRect(0, 0, c.width, c.height);
        setRevealed(true);
      }
    }
  }

  return (
    <div className="hg-game">
      <div className="sc-card">
        <div className="sc-under">
          <span className="sc-emoji">{prize.emoji}</span>
          <b>{prize.label} !</b>
        </div>
        <canvas
          ref={canvasRef}
          width={240}
          height={130}
          className="sc-foil"
          onPointerMove={scratch}
          onPointerDown={scratch}
          style={{ touchAction: "none" }}
        />
      </div>
      {revealed ? (
        <div className="hw-result">
          <b>{prize.emoji} {prize.label} !</b>
          <button className="hw-again" onClick={reset}>Rejouer</button>
        </div>
      ) : (
        <p className="hg-hint">Grattez la carte avec votre doigt 👆</p>
      )}
    </div>
  );
}

/* ── Machine à sous jouable ──────────────────────────────── */
const POOL = ["🎁", "☕", "🍰", "🏷️", "🍹", "⭐"];

function HomeSlot() {
  const [reels, setReels] = useState(["🎁", "⭐", "🍹"]);
  const [spinning, setSpinning] = useState(false);
  const [won, setWon] = useState<(typeof PRIZES)[number] | null>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(() => () => timersRef.current.forEach(clearInterval), []);

  function play() {
    if (spinning) return;
    setWon(null);
    setSpinning(true);
    const prize = PRIZES[Math.floor(Math.random() * PRIZES.length)];
    const stops = [900, 1500, 2100];
    timersRef.current = [0, 1, 2].map((i) =>
      window.setInterval(() => {
        setReels((r) => {
          const n = [...r];
          n[i] = POOL[Math.floor(Math.random() * POOL.length)];
          return n;
        });
      }, 80)
    );
    stops.forEach((ms, i) =>
      window.setTimeout(() => {
        clearInterval(timersRef.current[i]);
        setReels((r) => {
          const n = [...r];
          n[i] = prize.emoji;
          return n;
        });
        if (i === 2) {
          setSpinning(false);
          setWon(prize);
        }
      }, ms)
    );
  }

  return (
    <div className="hg-game">
      <div className="sl-machine">
        {reels.map((r, i) => (
          <span key={i} className={`sl-reel${spinning ? " spin" : ""}`}>{r}</span>
        ))}
      </div>
      {won ? (
        <div className="hw-result">
          <b>{won.emoji} {won.label} !</b>
          <button className="hw-again" onClick={play}>Rejouer</button>
        </div>
      ) : (
        <button className="hw-btn" onClick={play} disabled={spinning}>
          {spinning ? "Ça tourne…" : "🎰 Lancer la machine"}
        </button>
      )}
    </div>
  );
}

/* ── Sélecteur des 3 jeux ────────────────────────────────── */
export default function HomeGames() {
  const [game, setGame] = useState<"wheel" | "scratch" | "slot">("wheel");
  return (
    <div className="hg">
      <div className="hg-tabs" role="tablist" aria-label="Choisir le jeu de démo">
        <button
          role="tab"
          aria-selected={game === "wheel"}
          aria-label="Roue"
          className={`hg-tab${game === "wheel" ? " on" : ""}`}
          onClick={() => setGame("wheel")}
        >
          🎡<span className="hg-tab-txt"> Roue</span>
        </button>
        <button
          role="tab"
          aria-selected={game === "scratch"}
          aria-label="Grattage"
          className={`hg-tab${game === "scratch" ? " on" : ""}`}
          onClick={() => setGame("scratch")}
        >
          🎫<span className="hg-tab-txt"> Grattage</span>
        </button>
        <button
          role="tab"
          aria-selected={game === "slot"}
          aria-label="Machine à sous"
          className={`hg-tab${game === "slot" ? " on" : ""}`}
          onClick={() => setGame("slot")}
        >
          🎰<span className="hg-tab-txt"> Machine</span>
        </button>
      </div>
      {game === "wheel" && <HomeWheel />}
      {game === "scratch" && <HomeScratch />}
      {game === "slot" && <HomeSlot />}
    </div>
  );
}
