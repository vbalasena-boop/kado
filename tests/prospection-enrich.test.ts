import { describe, it, expect } from "vitest";
import {
  deobfuscate,
  extractEmails,
  pickBestEmail,
  extractContact,
  extractInstagram,
  contactLinks,
} from "@/lib/prospection/enrich";

describe("deobfuscate", () => {
  it("reconstitue les emails obfusqués", () => {
    expect(deobfuscate("contact [at] resto [dot] fr")).toContain("contact@resto.fr");
    expect(deobfuscate("bonjour (at) salon (point) fr")).toContain("bonjour@salon.fr");
  });
});

describe("extractEmails", () => {
  it("récupère les emails valides et déduplique", () => {
    const emails = extractEmails("a contact@resto.fr et contact@resto.fr");
    expect(emails).toEqual(["contact@resto.fr"]);
  });

  it("exclut les préfixes techniques et service client", () => {
    const emails = extractEmails("noreply@resto.fr sav@resto.fr postmaster@resto.fr");
    expect(emails).toEqual([]);
  });

  it("ignore images, domaines exclus", () => {
    expect(extractEmails("logo@2x.png a@example.com u@sentry.io")).toEqual([]);
  });
});

describe("pickBestEmail (zéro devinette)", () => {
  it("privilégie un email du domaine du site", () => {
    const best = pickBestEmail(
      ["jean@gmail.com", "contact@resto.fr"],
      "resto.fr"
    );
    expect(best).toBe("contact@resto.fr");
  });

  it("accepte un freemail si pas d'email du domaine", () => {
    expect(pickBestEmail(["lebistrot@gmail.com"], "resto.fr")).toBe("lebistrot@gmail.com");
  });

  it("ignore un email d'un autre domaine (ambigu)", () => {
    // ni domaine du site, ni freemail → on ne devine pas
    expect(pickBestEmail(["contact@prestataire-web.fr"], "resto.fr")).toBeNull();
  });

  it("préfère un préfixe de contact parmi plusieurs du domaine", () => {
    const best = pickBestEmail(
      ["jean.dupont@resto.fr", "contact@resto.fr"],
      "resto.fr"
    );
    expect(best).toBe("contact@resto.fr");
  });
});

describe("extractContact", () => {
  it("classe l'email selon le domaine du site + trouve l'Instagram", () => {
    const html = `<a href="mailto:contact@resto.fr">écrire</a>
      <a href="https://instagram.com/le.resto/">insta</a>`;
    const c = extractContact(html, "resto.fr");
    expect(c.email).toBe("contact@resto.fr");
    expect(c.instagram).toBe("le.resto");
  });
});

describe("extractInstagram", () => {
  it("trouve le handle du profil, ignore posts/reels", () => {
    expect(extractInstagram(`instagram.com/le.petit.cafe/`)).toBe("le.petit.cafe");
    expect(extractInstagram(`instagram.com/p/ABC instagram.com/reel/XYZ`)).toBeNull();
  });
});

describe("contactLinks", () => {
  it("repère les pages contact / mentions légales du même hôte", () => {
    const html = `<a href="/contact">Contact</a>
      <a href="/mentions-legales">Mentions</a>
      <a href="https://autre-site.fr/contact">externe</a>`;
    const links = contactLinks(html, "https://resto.fr");
    expect(links).toContain("https://resto.fr/contact");
    expect(links.some((l) => l.includes("mentions-legales"))).toBe(true);
    expect(links.some((l) => l.includes("autre-site.fr"))).toBe(false);
  });
});
