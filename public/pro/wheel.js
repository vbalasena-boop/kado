"use strict";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const PRIZES = [
    { emoji: "☕", name: "Café", color: "#ff5d73", weight: 20 },
    { emoji: "🍰", name: "Dessert", color: "#8b6cff", weight: 12 },
    { emoji: "😅", name: "Presque…", color: "#2c1e52", weight: 24, none: true },
    { emoji: "🎁", name: "-10 %", color: "#4fc3f7", weight: 18 },
    { emoji: "🥐", name: "Viennoiserie", color: "#ff8a5c", weight: 12 },
    { emoji: "⭐", name: "Boisson", color: "#39d98a", weight: 14 },
  ];
  const N = PRIZES.length, SEG = (Math.PI * 2) / N;
  const cv = document.getElementById("wheel"), ctx = cv.getContext("2d"), R = cv.width / 2;

  function draw(rot) {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.save(); ctx.translate(R, R); ctx.rotate(rot);
    for (let i = 0; i < N; i++) {
      const a0 = i * SEG;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R - 6, a0, a0 + SEG); ctx.closePath();
      ctx.fillStyle = PRIZES[i].color; ctx.fill();
      ctx.strokeStyle = "rgba(18,10,36,0.55)"; ctx.lineWidth = 4; ctx.stroke();
      ctx.save(); ctx.rotate(a0 + SEG / 2); ctx.textAlign = "right";
      ctx.fillStyle = PRIZES[i].none ? "rgba(253,244,227,0.75)" : "#150c29";
      ctx.font = "600 40px 'Fredoka', sans-serif"; ctx.fillText(PRIZES[i].emoji, R - 40, 6);
      ctx.font = "600 20px 'Manrope', sans-serif"; ctx.fillText(PRIZES[i].name, R - 92, 5);
      ctx.restore();
    }
    for (let i = 0; i < N; i++) {
      const a = i * SEG, x = Math.cos(a) * (R - 16), y = Math.sin(a) * (R - 16);
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,248,230,0.95)"; ctx.fill();
    }
    ctx.restore();
    const g = ctx.createRadialGradient(R, R * 0.72, R * 0.1, R, R, R);
    g.addColorStop(0, "rgba(255,255,255,0.16)"); g.addColorStop(0.55, "rgba(255,255,255,0.03)"); g.addColorStop(1, "rgba(0,0,0,0.18)");
    ctx.beginPath(); ctx.arc(R, R, R - 6, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  }
  draw(0);

  function pickIndex() {
    const total = PRIZES.reduce((s, p) => s + p.weight, 0);
    let r = Math.random() * total;
    for (let i = 0; i < N; i++) { r -= PRIZES[i].weight; if (r < 0) return i; }
    return N - 1;
  }

  const spinBtn = document.getElementById("spin");
  const gate = document.getElementById("gate"), result = document.getElementById("result");
  let unlocked = false, spinning = false, current = 0;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  function spin() {
    if (spinning) return;
    if (!unlocked) { gate.classList.add("show"); return; }
    spinning = true; spinBtn.disabled = true;
    const idx = pickIndex();
    const segCenter = idx * SEG + SEG / 2;
    const turns = 6 + Math.floor(Math.random() * 2);
    const target = turns * Math.PI * 2 - Math.PI / 2 - segCenter;
    const start = current, delta = target - (start % (Math.PI * 2));
    const dur = reduce ? 400 : 4600, t0 = performance.now();
    (function frame(now) {
      const t = Math.min(1, (now - t0) / dur);
      current = start + delta * easeOutCubic(t); draw(current);
      if (t < 1) requestAnimationFrame(frame);
      else { current = ((target % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); draw(current); spinning = false; showResult(idx); }
    })(t0);
  }

  function showResult(idx) {
    const p = PRIZES[idx], win = !p.none;
    document.getElementById("r-emoji").textContent = p.emoji;
    document.getElementById("r-title").textContent = win ? "Bravo ! 🎉" : "Presque !";
    document.getElementById("r-name").textContent = win ? p.name + " offert" : p.name;
    document.getElementById("r-lead").textContent = win ? "Montrez ce code en caisse :" : "Rien cette fois — revenez vite retenter votre chance !";
    const code = document.getElementById("r-code"), valid = document.getElementById("r-valid");
    if (win) { code.style.display = ""; valid.style.display = ""; code.textContent = "KADO-" + Math.random().toString(36).slice(2, 6).toUpperCase(); }
    else { code.style.display = "none"; valid.style.display = "none"; }
    result.classList.add("show");
    if (win && !reduce) burst();
  }

  spinBtn.addEventListener("click", spin);
  document.getElementById("follow").addEventListener("click", () => { unlocked = true; gate.classList.remove("show"); setTimeout(spin, 250); });
  document.getElementById("replay").addEventListener("click", () => { result.classList.remove("show"); spinBtn.disabled = false; });
  result.addEventListener("click", (e) => { if (e.target === result) { result.classList.remove("show"); spinBtn.disabled = false; } });
  gate.addEventListener("click", (e) => { if (e.target === gate) gate.classList.remove("show"); });

  const conf = document.getElementById("confetti"), cctx = conf.getContext("2d");
  function burst() {
    conf.style.display = "block"; conf.width = innerWidth; conf.height = innerHeight;
    const colors = ["#ffc24d", "#ff5d73", "#8b6cff", "#39d98a", "#4fc3f7", "#ff8a5c"];
    const parts = Array.from({ length: 140 }, () => ({
      x: innerWidth / 2, y: innerHeight * 0.3, vx: (Math.random() - 0.5) * 14, vy: Math.random() * -14 - 4,
      s: Math.random() * 7 + 4, c: colors[(Math.random() * colors.length) | 0], rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
    }));
    const t0 = performance.now();
    (function frame(now) {
      const el = now - t0; cctx.clearRect(0, 0, conf.width, conf.height);
      parts.forEach((p) => { p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.rot += p.vr;
        cctx.save(); cctx.translate(p.x, p.y); cctx.rotate(p.rot); cctx.fillStyle = p.c; cctx.fillRect(-p.s/2, -p.s/2, p.s, p.s*0.6); cctx.restore(); });
      if (el < 2600) requestAnimationFrame(frame); else { cctx.clearRect(0, 0, conf.width, conf.height); conf.style.display = "none"; }
    })(t0);
  }
