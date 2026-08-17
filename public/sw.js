/* Kado — service worker minimal pour les notifications de commandes.
   Affiche les notifications locales et ramène le commerçant sur sa page
   Commandes quand il clique dessus. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/* Notification push reçue (fonctionne même téléphone verrouillé) */
self.addEventListener("push", (event) => {
  let data = { title: "🛒 Nouvelle commande !", body: "", url: "/dashboard/orders" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    /* payload non JSON */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "kado-order",
      renotify: true,
      vibrate: [120, 60, 120],
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard/orders";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes("/dashboard/orders") && "focus" in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});
