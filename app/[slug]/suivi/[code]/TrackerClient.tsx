"use client";

import { useEffect, useRef, useState } from "react";

function euros(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Convertit la clé VAPID publique au format attendu par le navigateur. */
function vapidKey(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function TrackerClient({
  slug,
  name,
  code,
  initialStatus,
  items,
  totalCents,
  serviceMode,
  tableLabel,
  buzzerNo,
  paid = false,
}: {
  slug: string;
  name: string;
  code: string;
  initialStatus: string;
  items: { name: string; qty: number; price_cents: number }[];
  totalCents: number;
  serviceMode: string;
  tableLabel: string | null;
  buzzerNo: number | null;
  paid?: boolean;
}) {
  const isBuzzer = serviceMode === "buzzer" || buzzerNo != null;
  const [status, setStatus] = useState(initialStatus);
  const [alert, setAlert] = useState<"idle" | "on" | "ko">("idle");
  const [buzzing, setBuzzing] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  const audioRef = useRef<AudioContext | null>(null);
  const lastStatusRef = useRef(initialStatus);
  const alertedRef = useRef(false);

  // Débloque l'audio dès la 1re interaction (iOS l'exige) + détecte iPhone.
  useEffect(() => {
    const ua = navigator.userAgent || "";
    const isIOS = /iP(hone|ad|od)/.test(ua);
    const standalone =
      (navigator as any).standalone === true ||
      window.matchMedia?.("(display-mode: standalone)").matches;
    if (isIOS && !standalone) setIosHint(true);

    function unlock() {
      if (!audioRef.current) {
        try {
          const Ctx =
            (window as any).AudioContext || (window as any).webkitAudioContext;
          if (Ctx) audioRef.current = new Ctx();
        } catch {
          /* audio indisponible */
        }
      }
      audioRef.current?.resume?.();
    }
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  // Le « bipeur » : son + vibration + flash quand la commande passe « prête ».
  function fireBuzzer() {
    if (alertedRef.current) return;
    alertedRef.current = true;
    setBuzzing(true);
    try {
      (navigator as any).vibrate?.([200, 100, 200, 100, 500]);
    } catch {
      /* pas de vibration (iOS) */
    }
    const ctx = audioRef.current;
    if (ctx) {
      try {
        ctx.resume?.();
        [0, 500, 1000].forEach((delay) => {
          const t0 = ctx.currentTime + delay / 1000;
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(880, t0);
          osc.frequency.setValueAtTime(1175, t0 + 0.18);
          g.gain.setValueAtTime(0.001, t0);
          g.gain.exponentialRampToValueAtTime(0.4, t0 + 0.03);
          g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.36);
          osc.connect(g).connect(ctx.destination);
          osc.start(t0);
          osc.stop(t0 + 0.38);
        });
      } catch {
        /* audio bloqué */
      }
    }
    try {
      document.title = "✅ C'est prêt !";
    } catch {
      /* ignore */
    }
    setTimeout(() => setBuzzing(false), 8000);
  }

  const onsite = serviceMode === "sur_place";
  const cancelled = status === "cancelled";
  const reached = status === "done" ? 3 : status === "ready" ? 2 : 1;
  const TRACK = ["Reçue", "En préparation", "Prête", onsite ? "Servie" : "Retirée"];

  // Interrogation du statut en direct
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const r = await fetch(
          `/api/order/status?slug=${encodeURIComponent(
            slug
          )}&code=${encodeURIComponent(code)}`
        );
        const d = await r.json().catch(() => ({}));
        if (alive && d?.status) {
          if (d.status === "ready" && lastStatusRef.current !== "ready") {
            fireBuzzer();
          }
          lastStatusRef.current = d.status;
          setStatus(d.status);
        }
        if (alive && !["ready", "done", "cancelled"].includes(d?.status)) {
          timer = setTimeout(poll, 12000);
        }
      } catch {
        if (alive) timer = setTimeout(poll, 20000);
      }
    }
    if (!["ready", "done", "cancelled"].includes(initialStatus)) {
      timer = setTimeout(poll, 8000);
    }
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [slug, code, initialStatus]);

  async function enableAlert() {
    try {
      if (
        !("Notification" in window) ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        setAlert("ko");
        return;
      }
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
      if (Notification.permission !== "granted") {
        setAlert("ko");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const res = await fetch("/api/push");
      const { key } = await res.json();
      if (!key) {
        setAlert("ko");
        return;
      }
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey(key),
        }));
      const json = sub.toJSON();
      const r = await fetch("/api/order/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, code, push: { endpoint: json.endpoint, keys: json.keys } }),
      });
      setAlert(r.ok ? "on" : "ko");
    } catch {
      setAlert("ko");
    }
  }

  const bannerEmoji = cancelled
    ? "❌"
    : status === "ready"
    ? "✅"
    : status === "done"
    ? "🙌"
    : "👨‍🍳";
  const bannerText = cancelled
    ? "Commande annulée"
    : status === "ready"
    ? "Votre commande est prête !"
    : status === "done"
    ? "Commande récupérée — merci !"
    : "En préparation…";

  return (
    <main className="uber">
      {buzzing && (
        <div className="buzz-flash" aria-hidden="true">
          <div className="buzz-flash-in">✅ C'est prêt !</div>
        </div>
      )}
      <div className="uber-done">
        <div className="uber-done-emoji">{status === "ready" ? "✅" : "🧾"}</div>
        <h1>Suivi de commande</h1>
        <p style={{ marginTop: -4 }}>
          <b>{name}</b>
        </p>

        <div
          className={`track-banner${status === "ready" ? " ready" : ""}${
            cancelled ? " cancelled" : ""
          }`}
        >
          <span className="track-banner-emoji">{bannerEmoji}</span>
          <b>{bannerText}</b>
        </div>

        {!cancelled && (
          <ol className="track">
            {TRACK.map((label, i) => (
              <li
                key={label}
                className={i < reached ? "done" : i === reached ? "active" : "todo"}
              >
                <span className="track-dot">{i < reached ? "✓" : i + 1}</span>
                <span className="track-label">{label}</span>
              </li>
            ))}
          </ol>
        )}

        {onsite && tableLabel && !cancelled && (
          <div className="track-table">🍽️ Table {tableLabel}</div>
        )}

        {isBuzzer ? (
          <>
            {buzzerNo != null && (
              <div className="track-number">
                <span>Votre numéro</span>
                <b>{buzzerNo}</b>
              </div>
            )}
            {!cancelled && (
              <p style={{ fontWeight: 700 }}>
                📣 Donnez ce numéro au comptoir.
              </p>
            )}
          </>
        ) : (
          <>
            <div className="uber-done-code">{code}</div>
            {items.length > 0 && (
              <ul className="order-items" style={{ width: "100%", maxWidth: 420 }}>
                {items.map((l, i) => (
                  <li key={i}>
                    {l.qty} × {l.name}
                    <span>{euros(l.price_cents * l.qty)} €</span>
                  </li>
                ))}
              </ul>
            )}
            {totalCents > 0 && (
              <p className="uber-done-total">
                {paid ? (
                  <>✅ Payé en ligne : <b>{euros(totalCents)} €</b></>
                ) : (
                  <>Total à régler sur place : <b>{euros(totalCents)} €</b></>
                )}
              </p>
            )}
          </>
        )}

        {/* Activer l'alerte quand c'est prêt */}
        {!["ready", "done", "cancelled"].includes(status) && (
          <>
            {alert === "on" ? (
              <p className="track-banner ready" style={{ marginTop: 8 }}>
                <span className="track-banner-emoji">🔔</span>
                <b>Alerte activée — vous serez prévenu !</b>
              </p>
            ) : (
              <button
                type="button"
                className="uber-submit"
                style={{ maxWidth: 420 }}
                onClick={enableAlert}
              >
                🔔 M'alerter quand c'est prêt
              </button>
            )}
            {alert === "ko" && (
              <p className="uber-fine">
                Notifications non disponibles sur cet appareil — gardez cette
                page ouverte&nbsp;: elle <b>sonne et clignote</b> dès que c'est
                prêt.
              </p>
            )}
            {iosHint && alert !== "on" && (
              <p className="ios-hint">
                📲 <b>iPhone&nbsp;:</b> pour être prévenu même écran éteint,
                touchez <b>Partager</b> → <b>« Sur l'écran d'accueil »</b>, puis
                rouvrez Kado depuis l'icône. Sinon, gardez cette page ouverte.
              </p>
            )}
          </>
        )}
        <p className="uber-fine">
          💡 <b>Gardez cette page ouverte</b>&nbsp;: elle <b>sonne et clignote</b>{" "}
          dès que c'est prêt, et se met à jour toute seule. Présentez votre{" "}
          {isBuzzer ? "numéro" : "code"} au comptoir.
        </p>
      </div>
    </main>
  );
}
