"use client";

import { useState } from "react";

const SEGMENTS = [
  { emoji: "🎁", label: "Cadeau surprise", color: "#c0603f" },
  { emoji: "☕", label: "Café offert", color: "#8a5a34" },
  { emoji: "🍰", label: "Dessert offert", color: "#d98a5a" },
  { emoji: "🏷️", label: "-10 % sur l'addition", color: "#9c6b3f" },
  { emoji: "🍹", label: "Boisson offerte", color: "#e0a34a" },
  { emoji: "⭐", label: "Une bonne surprise", color: "#b8875a" },
];

const SEG = 360 / SEGMENTS.length;

// Découpe SVG : chaque part démarre en haut (12 h) et tourne dans le sens horaire.
function arc(i: number) {
  const a0 = (i * SEG - 90) * (Math.PI / 180);
  const a1 = ((i + 1) * SEG - 90) * (Math.PI / 180);
  const r = 44;
  const x0 = 50 + r * Math.cos(a0);
  const y0 = 50 + r * Math.sin(a0);
  const x1 = 50 + r * Math.cos(a1);
  const y1 = 50 + r * Math.sin(a1);
  return `M50 50 L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 0 1 ${x1.toFixed(
    2
  )} ${y1.toFixed(2)} Z`;
}
function emojiPos(i: number) {
  const a = ((i + 0.5) * SEG - 90) * (Math.PI / 180);
  const r = 30;
  return { x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) + 3 };
}

export default function HomeWheel() {
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [won, setWon] = useState<number | null>(null);

  function spin() {
    if (spinning) return;
    setWon(null);
    const target = Math.floor(Math.random() * SEGMENTS.length);
    // Amener le centre de la part gagnante sous le repère (en haut).
    const rest = 360 - (target * SEG + SEG / 2);
    const next = angle - (angle % 360) + 360 * 5 + rest;
    setSpinning(true);
    setAngle(next);
    window.setTimeout(() => {
      setSpinning(false);
      setWon(target);
    }, 4200);
  }

  return (
    <div className="hw">
      <div className="hw-wheel-wrap">
        <span className="hw-pointer" />
        <svg
          viewBox="0 0 100 100"
          className="hw-wheel"
          style={{
            transform: `rotate(${angle}deg)`,
            transition: spinning
              ? "transform 4.2s cubic-bezier(.17,.67,.2,1)"
              : "none",
          }}
        >
          <g stroke="#fff" strokeWidth="1.1" strokeLinejoin="round">
            {SEGMENTS.map((s, i) => (
              <path key={i} d={arc(i)} fill={s.color} />
            ))}
          </g>
          <g fontSize="9" textAnchor="middle">
            {SEGMENTS.map((s, i) => {
              const p = emojiPos(i);
              return (
                <text key={i} x={p.x} y={p.y}>
                  {s.emoji}
                </text>
              );
            })}
          </g>
          <circle cx="50" cy="50" r="44" fill="none" stroke="#f0a52e" strokeWidth="3" />
          <circle cx="50" cy="50" r="11" fill="#8a5a34" stroke="#1b1035" strokeWidth="3" />
        </svg>
      </div>

      {won === null ? (
        <button className="hw-btn" onClick={spin} disabled={spinning}>
          {spinning ? "La roue tourne…" : "🎡 Tourner la roue"}
        </button>
      ) : (
        <div className="hw-result">
          <b>{SEGMENTS[won].emoji} {SEGMENTS[won].label} !</b>
          <button className="hw-again" onClick={spin}>
            Rejouer
          </button>
        </div>
      )}
    </div>
  );
}
