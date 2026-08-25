import { describe, it, expect } from "vitest";
import { extractContact } from "@/lib/prospection/enrich";

describe("extractContact — email", () => {
  it("trouve un email dans un lien mailto", () => {
    const html = `<a href="mailto:contact@resto.fr">Nous écrire</a>`;
    expect(extractContact(html).email).toBe("contact@resto.fr");
  });

  it("privilégie une adresse de contact générique", () => {
    const html = `bla jean.dupont@resto.fr ... contact@resto.fr`;
    expect(extractContact(html).email).toBe("contact@resto.fr");
  });

  it("ignore les faux positifs (images, sentry, example)", () => {
    const html = `logo@2x.png u@sentry.io a@example.com`;
    expect(extractContact(html).email).toBeNull();
  });

  it("renvoie null si aucun email", () => {
    expect(extractContact("<p>pas d'email ici</p>").email).toBeNull();
  });
});

describe("extractContact — Instagram", () => {
  it("trouve le handle depuis un lien profil", () => {
    const html = `<a href="https://www.instagram.com/le.petit.cafe/">Insta</a>`;
    expect(extractContact(html).instagram).toBe("le.petit.cafe");
  });

  it("ignore les liens de post/reel/explore", () => {
    const html = `https://instagram.com/p/ABC123 https://instagram.com/reel/XYZ`;
    expect(extractContact(html).instagram).toBeNull();
  });

  it("renvoie null si pas d'Instagram", () => {
    expect(extractContact("<p>rien</p>").instagram).toBeNull();
  });
});
