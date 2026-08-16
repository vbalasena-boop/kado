"use client";

import { useState } from "react";

const GOAL = 10;

export default function HomeLoyalty() {
  const [stamps, setStamps] = useState(6);
  const done = stamps >= GOAL;

  function add() {
    setStamps((s) => (s >= GOAL ? s : s + 1));
  }
  function reset() {
    setStamps(0);
  }

  return (
    <div className="lc-mock" role="group" aria-label="Carte de fidélité interactive">
      <div className="lc-mock-head">
        <div className="lc-mock-brand">💇 Salon Éléonore</div>
        <div className="lc-mock-badge">
          {Math.min(stamps, GOAL)} / {GOAL}
        </div>
      </div>
      <div className="lc-mock-title">Carte de fidélité</div>
      <div className="lc-mock-progress">
        <span style={{ width: `${(Math.min(stamps, GOAL) / GOAL) * 100}%` }} />
      </div>
      <div className="lc-mock-grid">
        {Array.from({ length: GOAL }, (_, i) => (
          <span key={i} className={`lc-mock-stamp${i < stamps ? " on" : ""}`}>
            {i < stamps ? "💅" : i + 1}
          </span>
        ))}
      </div>

      {done ? (
        <div className="lc-mock-won">
          <b>🎉 Récompense débloquée&nbsp;: un brushing offert !</b>
          <button className="hw-again" onClick={reset}>
            Recommencer
          </button>
        </div>
      ) : (
        <>
          <div className="lc-mock-reward">
            🎁 <b>{GOAL} visites</b> = un brushing offert
          </div>
          <button className="lc-mock-btn" onClick={add}>
            + Ajouter un tampon
          </button>
        </>
      )}
    </div>
  );
}
