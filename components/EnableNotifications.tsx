"use client";

import { useEffect, useState } from "react";

/** Convertit la clé VAPID publique au format attendu par le navigateur. */
function vapidKey(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Bouton autonome : abonne CET appareil aux notifications du commerçant. */
export function EnableNotifications() {
  const [state, setState] = useState<"idle" | "on" | "unsupported">("idle");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "granted") setState("on");
  }, []);

  async function enable() {
    try {
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
      if (Notification.permission !== "granted") return;
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      if (!("PushManager" in window)) return;
      const res = await fetch("/api/dashboard/push");
      const { key } = await res.json();
      if (!key) return; // clés VAPID pas configurées
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey(key),
        }));
      const json = sub.toJSON();
      await fetch("/api/dashboard/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      setState("on");
    } catch {
      /* push indisponible (iPhone non installé en app, etc.) */
    }
  }

  if (state === "unsupported")
    return (
      <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
        Notifications non disponibles sur cet appareil.
      </p>
    );
  if (state === "on")
    return (
      <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
        🔔 Notifications activées sur cet appareil.
      </p>
    );
  return (
    <button
      type="button"
      className="btn-secondary"
      style={{ marginTop: 8 }}
      onClick={enable}
    >
      🔔 Activer les notifications sur cet appareil
    </button>
  );
}
