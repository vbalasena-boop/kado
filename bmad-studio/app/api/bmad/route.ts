import { NextRequest } from "next/server";
import { anthropic, MODEL } from "@/lib/anthropic";
import { getStage, type StageInput } from "@/lib/agents";
import { extractJson, type FeasibilityReport } from "@/lib/feasibility";

export const runtime = "nodejs";
// Une analyse complète peut être longue : on laisse de la marge (serverless).
export const maxDuration = 300;

interface RequestBody extends StageInput {
  stageId: string;
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const stage = getStage(body.stageId);
  if (!stage) {
    return Response.json({ error: `Étape inconnue : ${body.stageId}` }, { status: 400 });
  }

  if (!body.idea?.trim()) {
    return Response.json({ error: "Décris d'abord ton idée." }, { status: 400 });
  }

  // Vérifie que les artefacts requis sont présents.
  for (const dep of stage.requires) {
    if (!body.artifacts?.[dep]) {
      return Response.json(
        { error: `Étape « ${dep} » requise avant « ${stage.id} ».` },
        { status: 400 },
      );
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY manquante. Ajoute-la dans .env.local." },
      { status: 500 },
    );
  }

  const userPrompt = stage.buildPrompt({
    idea: body.idea,
    answers: body.answers || {},
    artifacts: body.artifacts || {},
  });

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 12000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      system: stage.system,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (stage.outputFormat === "feasibility") {
      const data = extractJson<FeasibilityReport>(text);
      if (!data) {
        return Response.json(
          { error: "Réponse non exploitable du modèle.", raw: text },
          { status: 502 },
        );
      }
      return Response.json({ stageId: stage.id, format: "feasibility", data, raw: text });
    }

    return Response.json({ stageId: stage.id, format: "markdown", markdown: text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue.";
    return Response.json({ error: `Appel Claude échoué : ${message}` }, { status: 502 });
  }
}
