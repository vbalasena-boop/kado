import { describe, it, expect, afterEach } from "vitest";
import {
  buildPrompt,
  parseAiMessages,
  assembleEmail,
  writeMessagesWithAI,
  buildFollowupPrompt,
  parseAiEmail,
  writeFollowupWithAI,
  normalizeTone,
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

  it("n'inclut PAS de lien dans le 1er email (anti-Promotions)", () => {
    process.env.PROSPECT_BOOKING_URL = "https://cal.com/kado/15min";
    const { system } = buildPrompt(ctx);
    expect(system).not.toContain("https://cal.com/kado/15min");
    expect(system.toLowerCase()).toContain("aucun lien");
  });

  it("intègre l'extrait du site et interdit d'inventer au-delà", () => {
    const { system, user } = buildPrompt({ ...ctx, siteText: "Brunch et café de spécialité, cours de latte art." });
    expect(user).toContain("Brunch et café de spécialité");
    expect(system.toLowerCase()).toContain("invente jamais");
  });

  it("applique la tonalité choisie", () => {
    expect(buildPrompt({ ...ctx, tone: "court" }).system.toLowerCase()).toContain("ultra court");
    expect(buildPrompt({ ...ctx, tone: "direct" }).system.toLowerCase()).toContain("direct");
    // Tonalité inconnue → repli équilibré.
    expect(buildPrompt({ ...ctx, tone: "n'importe quoi" }).system.toLowerCase()).toContain("équilibré");
  });
});

describe("normalizeTone", () => {
  it("accepte les tons connus et retombe sur équilibré sinon", () => {
    expect(normalizeTone("direct")).toBe("direct");
    expect(normalizeTone("CHALEUREUX")).toBe("chaleureux");
    expect(normalizeTone("")).toBe("equilibre");
    expect(normalizeTone("xxx")).toBe("equilibre");
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
    const email = assembleEmail(ctx, { subject: "O", body: "Bonjour," });
    expect(email.body).toContain("{{unsubscribe_url}}");
    expect(email.body.startsWith("Bonjour,")).toBe(true);
  });

  it("ajoute le lien de RDV pour une relance (includeBooking=true)", () => {
    process.env.PROSPECT_BOOKING_URL = "https://cal.com/kado/15min";
    const email = assembleEmail(ctx, { subject: "O", body: "Bonjour," }, true);
    expect(email.body).toContain("https://cal.com/kado/15min");
  });

  it("n'ajoute PAS de lien pour le 1er email (défaut)", () => {
    process.env.PROSPECT_BOOKING_URL = "https://cal.com/kado/15min";
    const email = assembleEmail(ctx, { subject: "O", body: "Bonjour," });
    expect(email.body).not.toContain("https://cal.com/kado/15min");
  });

  it("ne duplique pas le lien de RDV s'il est déjà présent (relance)", () => {
    process.env.PROSPECT_BOOKING_URL = "https://cal.com/kado/15min";
    const body = "Bonjour, réservez → https://cal.com/kado/15min";
    const email = assembleEmail(ctx, { subject: "O", body }, true);
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

describe("relances IA", () => {
  it("buildFollowupPrompt distingue relance et dernier email", () => {
    const fu = buildFollowupPrompt(ctx, "followup");
    expect(fu.system.toLowerCase()).toContain("relance");
    expect(fu.system).toContain("subject");
    const last = buildFollowupPrompt(ctx, "last");
    expect(last.system.toLowerCase()).toContain("dernier");
    expect(last.system.toLowerCase()).toContain("rupture");
  });

  it("parseAiEmail lit subject + body (sans dm)", () => {
    const out = parseAiEmail('{"subject":"Relance","body":"Bonjour,"}');
    expect(out).toEqual({ subject: "Relance", body: "Bonjour," });
  });

  it("parseAiEmail jette si body manque", () => {
    expect(() => parseAiEmail('{"subject":"x"}')).toThrow();
  });

  it("writeFollowupWithAI renvoie un email assemblé (footer inclus)", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    const fakeFetch = (async () =>
      ({
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: '{"subject":"Petit rappel","body":"Bonjour Café,"}' }],
        }),
      }) as unknown as Response) as typeof fetch;
    const out = await writeFollowupWithAI(ctx, "followup", fakeFetch);
    expect(out.subject).toBe("Petit rappel");
    expect(out.body).toContain("Bonjour Café,");
    expect(out.body).toContain("{{unsubscribe_url}}");
  });

  it("writeFollowupWithAI jette si l'API échoue (repli gabarit côté caller)", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    const fakeFetch = (async () =>
      ({ ok: false, status: 500, json: async () => ({}) }) as unknown as Response) as typeof fetch;
    await expect(writeFollowupWithAI(ctx, "last", fakeFetch)).rejects.toThrow();
  });
});
