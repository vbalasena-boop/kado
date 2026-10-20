import type { Metadata } from "next";

export function publicMetadata(title: string, description: string, path: string): Metadata {
  const url = `https://kado-app.fr${path}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url, siteName: "Kado", locale: "fr_FR", type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}
