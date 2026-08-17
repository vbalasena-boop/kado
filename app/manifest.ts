import type { MetadataRoute } from "next";

/** Manifeste PWA : rend Kado installable sur l'écran d'accueil. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kado",
    short_name: "Kado",
    description:
      "Jeux, fidélité et commandes en ligne pour les commerces de proximité.",
    start_url: "/dashboard",
    // L'app installable « Kado » = l'espace commerçant. Les pages clients
    // (jeu, fidélité, commande) restent hors de ce périmètre : un client qui
    // ajoute sa carte à l'écran d'accueil obtient un raccourci vers SA carte.
    scope: "/dashboard",
    display: "standalone",
    background_color: "#17092e",
    theme_color: "#17092e",
    lang: "fr",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
