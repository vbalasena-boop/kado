import type { MetadataRoute } from "next";
import { ARTICLES } from "@/lib/blog";

const BASE = "https://kado-app.fr";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = [
    { path: "/", priority: 1 },
    { path: "/tarifs", priority: 0.8 },
    { path: "/blog", priority: 0.7 },
    ...ARTICLES.map((a) => ({ path: `/blog/${a.slug}`, priority: 0.6 })),
    { path: "/login", priority: 0.5 },
    { path: "/legal/mentions", priority: 0.3 },
    { path: "/legal/confidentialite", priority: 0.3 },
    { path: "/legal/cgu", priority: 0.3 },
    { path: "/legal/cgv", priority: 0.3 },
    { path: "/legal/reglement", priority: 0.3 },
  ];
  return routes.map((r) => ({
    url: `${BASE}${r.path}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: r.priority,
  }));
}
