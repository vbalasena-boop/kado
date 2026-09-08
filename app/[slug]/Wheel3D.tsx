"use client";

import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type { Prize } from "@/lib/draw";
import { paintWheelFace } from "@/lib/wheel-face";

/**
 * Roue de la fortune en VRAIE 3D (WebGL / Three.js).
 *
 * Principe de sûreté : la rotation n'est PAS calculée ici. `rotRef` (Game.tsx,
 * mis à jour par `animateTo`) reste l'unique source de vérité ; on se contente
 * de la LIRE à chaque frame et de faire tourner le maillage. La face du disque
 * est la texture peinte par `paintWheelFace` (le même dessin que la roue 2D,
 * à rot = 0) : mêmes secteurs, même ordre → l'alignement lot ↔ pointeur est
 * strictement celui d'avant.
 *
 * Three.js est chargé en import dynamique (uniquement sur l'écran de spin).
 * Si WebGL est indisponible ou que le chargement échoue, `onUnavailable()` est
 * appelé et Game.tsx retombe sur la roue 2D.
 */
export default function Wheel3D({
  prizes,
  rotRef,
  spinning,
  settling,
  onUnavailable,
}: {
  prizes: Prize[];
  rotRef: MutableRefObject<number>;
  spinning: boolean;
  settling: boolean;
  onUnavailable: () => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  // Drapeaux lus par la boucle de rendu sans la relancer.
  const spinningRef = useRef(spinning);
  const settlingRef = useRef(settling);
  const settleStartRef = useRef<number | null>(null);
  useEffect(() => {
    spinningRef.current = spinning;
  }, [spinning]);
  useEffect(() => {
    settlingRef.current = settling;
    if (settling) settleStartRef.current = performance.now();
  }, [settling]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || prizes.length === 0) return;
    let disposed = false;
    let raf = 0;
    let cleanup: (() => void) | null = null;

    (async () => {
      let THREE: typeof import("three");
      try {
        THREE = await import("three");
      } catch {
        onUnavailable();
        return;
      }
      if (disposed) return;

      // ---- Rendu (WebGL) -------------------------------------------------
      // Toute la mise en place est protégée : au moindre échec (contexte WebGL
      // refusé, texture/anisotropie, driver capricieux…) on libère ce qui a
      // été créé et on bascule sur le repli 2D — jamais de canvas vide ni de
      // contexte WebGL qui fuit.
      let renderer: import("three").WebGLRenderer | null = null;
      try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      // Caméra devant et au-dessus : on voit la face ET la tranche proche
      // (bas de l'écran). Le pointeur est au bord opposé (haut de l'écran).
      // Hôte au format large (le disque incliné est une ellipse) : la caméra
      // cadre serré pour ne pas laisser de vide au-dessus/en dessous.
      const camera = new THREE.PerspectiveCamera(24, 1.5, 0.1, 50);
      camera.position.set(0, 2.55, 3.05);
      camera.lookAt(0, -0.08, 0);

      // ---- Lumières ------------------------------------------------------
      scene.add(new THREE.AmbientLight(0xffffff, 0.75));
      const key = new THREE.DirectionalLight(0xffffff, 1.9);
      key.position.set(2.2, 4.5, 3.2);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xbfa9ff, 0.55);
      fill.position.set(-3, 1.5, -2);
      scene.add(fill);
      const sparkle = new THREE.PointLight(0xffd27a, 14, 8, 2);
      sparkle.position.set(-1.6, 1.4, 1.6);
      scene.add(sparkle);

      // ---- Face : texture peinte par le dessin 2D (rot = 0) -------------
      const faceCv = document.createElement("canvas");
      faceCv.width = 1024;
      faceCv.height = 1024;
      paintWheelFace(faceCv, prizes, 0);
      const face = new THREE.CanvasTexture(faceCv);
      face.colorSpace = THREE.SRGBColorSpace;
      face.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      // Le calotte du cylindre projette u→+Z, v→+X : vue de devant/dessus, le
      // canvas apparaît tourné de 90° horaire. On compense (antihoraire).
      face.center.set(0.5, 0.5);
      face.rotation = Math.PI / 2;
      face.needsUpdate = true;

      // ---- Disque : cylindre (côté sombre, face texturée, dessous sombre) --
      const H = 0.16;
      const dark = new THREE.MeshStandardMaterial({
        color: 0x1d1238,
        metalness: 0.55,
        roughness: 0.38,
      });
      const faceMat = new THREE.MeshPhysicalMaterial({
        map: face,
        roughness: 0.42,
        metalness: 0.04,
        clearcoat: 0.65,
        clearcoatRoughness: 0.22,
      });
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, H, 128, 1), [
        dark,
        faceMat,
        dark,
      ]);
      const wheel = new THREE.Group();
      wheel.add(disc);

      // ---- Habillage fixe : jante or, moyeu, pointeur, ombre au sol -------
      const gold = new THREE.MeshStandardMaterial({
        color: 0xffc24d,
        metalness: 0.92,
        roughness: 0.24,
      });
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.025, 0.05, 24, 160), gold);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = H / 2 - 0.01;
      const rimInner = new THREE.Mesh(new THREE.TorusGeometry(0.985, 0.022, 16, 160), dark);
      rimInner.rotation.x = Math.PI / 2;
      rimInner.position.y = H / 2 + 0.005;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.07, 48), gold);
      hub.position.y = H / 2 + 0.035;
      const hubRing = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.018, 12, 64), dark);
      hubRing.rotation.x = Math.PI / 2;
      hubRing.position.y = H / 2 + 0.02;
      const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.26, 28), gold);
      pointer.rotation.x = Math.PI / 2; // pointe vers +Z (vers le centre)
      pointer.position.set(0, H / 2 + 0.07, -1.06);
      // Ombre douce au sol (texture radiale) : ancre la roue sur un plan.
      const shCv = document.createElement("canvas");
      shCv.width = shCv.height = 256;
      const sctx = shCv.getContext("2d");
      if (sctx) {
        const g = sctx.createRadialGradient(128, 128, 10, 128, 128, 128);
        g.addColorStop(0, "rgba(0,0,0,0.62)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        sctx.fillStyle = g;
        sctx.fillRect(0, 0, 256, 256);
      }
      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(1.45, 64),
        new THREE.MeshBasicMaterial({
          map: new THREE.CanvasTexture(shCv),
          transparent: true,
          depthWrite: false,
        })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = -H / 2 - 0.02;

      const rig = new THREE.Group(); // groupe basculé par l'oscillation
      rig.add(wheel, rim, rimInner, hub, hubRing, pointer);
      scene.add(rig, shadow);

      // Déclaré AVANT `resize()` (appelé tout de suite) — une `let` plus bas
      // serait en zone morte temporelle → ReferenceError → repli 2D silencieux.
      // Rendu UNIQUEMENT quand quelque chose change (rotation, oscillation,
      // rebond, redimensionnement) : une roue immobile ne consomme rien —
      // sinon 60 rendus/s à vide sur mobile (batterie, chauffe).
      let lastRot = NaN;
      let lastTx = NaN;
      let lastTz = NaN;
      let forceRender = true;
      // ---- Taille ----------------------------------------------------------
      const resize = () => {
        const w = Math.max(1, host.clientWidth);
        const h = Math.max(1, host.clientHeight || Math.round(w * 0.68));
        renderer!.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        forceRender = true;
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(host);

      // ---- Boucle : lit rotRef (source de vérité) + oscillation / rebond ----
      const t0 = performance.now();
      const frame = (now: number) => {
        if (disposed) return;
        const t = (now - t0) / 1000;
        // Sens : rot positif = horaire à l'écran (convention du canvas 2D) ;
        // vu de dessus, une rotation +Y est antihoraire → on inverse.
        const rot = rotRef.current;
        wheel.rotation.y = -rot;
        let tx = 0;
        let tz = 0;
        if (!reduce) {
          if (spinningRef.current) {
            tx = Math.sin(t * 4.1) * 0.03;
            tz = Math.sin(t * 5.4) * 0.035;
          } else if (settlingRef.current && settleStartRef.current != null) {
            const dt = (now - settleStartRef.current) / 1000;
            tx = 0.11 * Math.exp(-4.2 * dt) * Math.cos(9 * dt);
          }
        }
        rig.rotation.x = tx;
        rig.rotation.z = tz;
        if (forceRender || rot !== lastRot || tx !== lastTx || tz !== lastTz) {
          renderer!.render(scene, camera);
          lastRot = rot;
          lastTx = tx;
          lastTz = tz;
          forceRender = false;
        }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);

      cleanup = () => {
        ro.disconnect();
        cancelAnimationFrame(raf);
        scene.traverse((o) => {
          const m = o as import("three").Mesh;
          if (m.geometry) m.geometry.dispose();
          const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
          for (const mat of mats) {
            const anyMat = mat as import("three").MeshStandardMaterial;
            if (anyMat.map) anyMat.map.dispose();
            mat.dispose();
          }
        });
        renderer?.dispose();
        renderer?.domElement.remove();
      };
      } catch {
        cancelAnimationFrame(raf);
        renderer?.dispose();
        renderer?.domElement.remove();
        onUnavailable();
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanup?.();
    };
    // `onUnavailable` est stable côté appelant (setState) ; rotRef est un ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prizes]);

  return <div ref={hostRef} className="wheel-gl-host" data-wheel="gl" aria-hidden="true" />;
}
