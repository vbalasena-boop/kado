/* Kado — service worker minimal pour les notifications de commandes.
   Affiche les notifications locales et ramène le commerçant sur sa page
   Commandes quand il clique dessus. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes("/dashboard/orders") && "focus" in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow("/dashboard/orders");
      })
  );
});
