import { describe, it, expect, afterEach } from "vitest";
import {
  buildPrompt,
  parseAiMessages,
  assembleEmail,
  writeMessagesWithAI,
} from "@/lib/prospection/ai-writer";
import type { TemplateContext } from "@/lib/prospection/templates";

const ctx: TemplateContext = {
  name: "Café du Coin",
  city: "Versailles",
  category: "resto",
  google_reviews_count: 12,
  seed: "abc",
};

afterEach(() => {
  delete process.env.PROSPECT_BOOKING_URL;
  delete process.env.ANTHROPIC_API_KEY;
});

describe("buildPrompt", () => {
  it("inclut les faits du prospect et le vouvoiement", () => {
    const { system, user } = buildPrompt(ctx);
    expect(user).toContain("Café du Coin");
    expect(user).toContain("Versailles");
    expect(system).toContain("vouvoiement");
    expect(system).toContain("JSON");
  });

  it("intègre le lien de RDV quand il est fourni", () => {
    process.env.PROSPECT_BOOKING_URL = "https://cal.com/kado/15min";
    const { system } = buildPrompt(ctx);
    expect(system).toContain("https://cal.com/kado/15min");
  });
});

describe("parseAiMessages", () => {
  it("parse un JSON propre", () => {
    const out = parseAiMessages('{"subject":"Objet","body":"Bonjour,","dm":"Salut"}');
    expect(out).toEqual({ subject: "Objet", body: "Bonjour,", dm: "Salut" });
  });

  it("tolère un bloc ```json ... ```", () => {
    const raw = '```json\n{"subject":"O","body":"B","dm":"D"}\n```';
    expect(parseAiMessages(raw).subject).toBe("O");
  });

  it("isole l'objet JSON au milieu de texte", () => {
    const raw = 'Voici :\n{"subject":"O","body":"B","dm":"D"}\nMerci';
    expect(parseAiMessages(raw).body).toBe("B");
  });

  it("jette si un champ manque", () => {
    expect(() => parseAiMessages('{"subject":"O","body":"B"}')).toThrow();
  });

  it("jette si ce n'est pas du JSON", () => {
    expect(() => parseAiMessages("désolé, je ne peux pas")).toThrow();
  });

  it("jette si un champ est anormalement long (anti-dérive)", () => {
    const long = "x".repeat(2000);
    expect(() => parseAiMessages(`{"subject":"O","body":"${long}","dm":"D"}`)).toThrow();
  });
});

describe("assembleEmail", () => {
  it("ajoute toujours le pied de page (désinscription/RGPD)", () => {
    const email = assembleEmail(ctx, { subject: "O", body: "Bonjour,", dm: "D" });
    expect(email.body).toContain("{{unsubscribe_url}}");
    expect(email.body.startsWith("Bonjour,")).toBe(true);
  });

  it("ajoute le lien de RDV s'il manque dans le corps", () => {
    process.env.PROSPECT_BOOKING_URL = "https://cal.com/kado/15min";
    const email = assembleEmail(ctx, { subject: "O", body: "Bonjour,", dm: "D" });
    expect(email.body).toContain("https://cal.com/kado/15min");
  });

  it("ne duplique pas le lien de RDV s'il est déjà présent", () => {
    process.env.PROSPECT_BOOKING_URL = "https://cal.com/kado/15min";
    const body = "Bonjour, réservez → https://cal.com/kado/15min";
    const email = assembleEmail(ctx, { subject: "O", body, dm: "D" });
    const count = email.body.split("https://cal.com/kado/15min").length - 1;
    expect(count).toBe(1);
  });
});

describe("writeMessagesWithAI", () => {
  it("appelle l'API et renvoie subject/body(+footer)/dm", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    const fakeFetch = (async () =>
      ({
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: '{"subject":"Objet","body":"Bonjour Café,","dm":"Salut"}' }],
        }),
      }) as unknown as Response) as typeof fetch;

    const out = await writeMessagesWithAI(ctx, fakeFetch);
    expect(out.subject).toBe("Objet");
    expect(out.body).toContain("Bonjour Café,");
    expect(out.body).toContain("{{unsubscribe_url}}"); // footer ajouté
    expect(out.dm).toBe("Salut");
  });

  it("jette si l'API renvoie une erreur (le caller retombe sur le gabarit)", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    const fakeFetch = (async () =>
      ({ ok: false, status: 429, json: async () => ({}) }) as unknown as Response) as typeof fetch;
    await expect(writeMessagesWithAI(ctx, fakeFetch)).rejects.toThrow();
  });

  it("jette si la clé API est absente", async () => {
    await expect(writeMessagesWithAI(ctx)).rejects.toThrow();
  });
});
