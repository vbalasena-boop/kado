import type { Prize } from "@/lib/draw";

/** Police du dessin de la roue (partagée avec la carte à gratter). */
export const WHEEL_FONT =
  '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';

const TAU = Math.PI * 2;

/**
 * Peint la FACE de la roue (secteurs, emojis, libellés, loupiotes, vernis) dans
 * un canvas 2D, tournée de `rot`. PARTAGÉ par le rendu 2D (repli) et la roue
 * WebGL, qui la peint à rot = 0 comme texture et fait tourner le maillage :
 * une seule source de vérité pour l'apparence ET l'ordre des secteurs.
 *
 * Module `lib/` (sans React) pour éviter un cycle d'import Game ↔ Wheel3D.
 */
export function paintWheelFace(
  cv: HTMLCanvasElement,
  prizes: Prize[],
  rot: number
): void {
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  const R = cv.width / 2;
  // Facteur d'échelle : les métriques ci-dessous sont calibrées pour le
  // canvas 2D de 680 px ; la texture WebGL (1024 px) les reçoit
  // proportionnellement, sinon les libellés y sortent ~34 % trop petits.
  const k = cv.width / 680;
  const seg = TAU / prizes.length;
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.save();
  ctx.translate(R, R);
  ctx.rotate(rot);
  prizes.forEach((p, i) => {
    const a0 = i * seg;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R - 6 * k, a0, a0 + seg);
    ctx.closePath();
    ctx.fillStyle = p.color || "#ff5d73";
    ctx.fill();
    ctx.strokeStyle = "rgba(21,12,41,.55)";
    ctx.lineWidth = 3 * k;
    ctx.stroke();
    ctx.save();
    ctx.rotate(a0 + seg / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#150c29";
    ctx.font = `700 ${27 * k}px ${WHEEL_FONT}`;
    ctx.fillText(p.emoji || "🎁", R - 30 * k, -6 * k);
    ctx.font = `800 ${20 * k}px ${WHEEL_FONT}`;
    const l =
      p.label.length > 13 ? p.label.slice(0, 12) + "…" : p.label;
    ctx.fillText(l, R - 30 * k, 20 * k);
    ctx.restore();
  });
  // petites lumières sur le pourtour (tournent avec la roue)
  for (let i = 0; i < prizes.length; i++) {
    const a = i * seg;
    const x = Math.cos(a) * (R - 15 * k);
    const y = Math.sin(a) * (R - 15 * k);
    ctx.beginPath();
    ctx.arc(x, y, 3.4 * k, 0, TAU);
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
  ctx.arc(R, R, R - 6 * k, 0, TAU);
  ctx.fillStyle = gloss;
  ctx.fill();
}
