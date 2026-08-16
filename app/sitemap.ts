import type { MetadataRoute } from "next";

const BASE = "https://kado-app.fr";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = [
    { path: "/", priority: 1 },
    { path: "/tarifs", priority: 0.8 },
    { path: "/login", priority: 0.5 },
    { path: "/legal/mentions", priority: 0.3 },
    { path: "/legal/confidentialite", priority: 0.3 },
    { path: "/legal/cgu", priority: 0.3 },
    { path: "/legal/cgv", priority: 0.3 },
  ];
  return routes.map((r) => ({
    url: `${BASE}${r.path}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: r.priority,
  }));
}
