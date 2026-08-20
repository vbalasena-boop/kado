"use client";

import { useMemo, useState } from "react";
import { marked } from "marked";
import { STAGES, type StageId, type GuidedAnswers } from "@/lib/agents";
import type { FeasibilityReport } from "@/lib/feasibility";

marked.setOptions({ breaks: true, gfm: true });

type Artifacts = Partial<Record<StageId, string>>;

function feasibilityToMarkdown(r: FeasibilityReport): string {
  const L: string[] = [];
  L.push(`# Analyse de faisabilité`);
  L.push(``, `**Verdict : ${r.verdict}** (score ${r.score}/100)`, ``, r.resume);
  L.push(``, `> ${r.verdict_justification}`);
  L.push(``, `## Avantages`);
  r.avantages?.forEach((a) => L.push(`- **${a.titre}** — ${a.detail}`));
  L.push(``, `## Contraintes`);
  r.contraintes?.forEach((c) =>
    L.push(`- **${c.titre}** (gravité : ${c.gravite}) — ${c.detail}`),
  );
  L.push(``, `## Risques`);
  r.risques?.forEach((x) =>
    L.push(
      `- **${x.titre}** (proba : ${x.probabilite}, impact : ${x.impact}) — ${x.detail}. _Mitigation : ${x.mitigation}_`,
    ),
  );
  L.push(``, `## Hypothèses à valider`);
  r.hypotheses?.forEach((h) => L.push(`- ${h}`));
  L.push(``, `## Prochaines étapes`);
  r.prochaines_etapes?.forEach((s) => L.push(`- ${s}`));
  return L.join("\n");
}

export default function Home() {
  const [idea, setIdea] = useState("");
  const [answers, setAnswers] = useState<GuidedAnswers>({});
  const [artifacts, setArtifacts] = useState<Artifacts>({});
  const [report, setReport] = useState<FeasibilityReport | null>(null);
  const [loading, setLoading] = useState<StageId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setAnswer = (k: keyof GuidedAnswers, v: string) =>
    setAnswers((a) => ({ ...a, [k]: v }));

  const canRun = (stageId: StageId): boolean => {
    const stage = STAGES.find((s) => s.id === stageId)!;
    if (!idea.trim()) return false;
    return stage.requires.every((dep) => Boolean(artifacts[dep]));
  };

  async function runStage(stageId: StageId) {
    setError(null);
    setLoading(stageId);
    try {
      const res = await fetch("/api/bmad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId, idea, answers, artifacts }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);

      if (json.format === "feasibility") {
        const data = json.data as FeasibilityReport;
        setReport(data);
        setArtifacts((a) => ({ ...a, analyst: feasibilityToMarkdown(data) }));
      } else {
        setArtifacts((a) => ({ ...a, [stageId]: json.markdown as string }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    } finally {
      setLoading(null);
    }
  }

  function exportAll() {
    const parts: string[] = [`# Dossier BMAD\n\n**Idée :** ${idea}\n`];
    for (const s of STAGES) {
      if (artifacts[s.id]) parts.push(`\n\n---\n\n${artifacts[s.id]}`);
    }
    const blob = new Blob([parts.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dossier-bmad.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasAny = useMemo(
    () => Object.keys(artifacts).length > 0,
    [artifacts],
  );

  return (
    <div className="wrap">
      <div className="hero">
        <h1>
          <span className="brandmark">BMAD Studio</span>
        </h1>
        <p>
          Décris ton idée. La chaîne <strong>BMAD</strong> — Analyste → Product
          Manager → Architecte → Scrum Master, chaque rôle joué par Claude — te
          rend une analyse de faisabilité complète, puis un PRD, une architecture
          et une roadmap.
        </p>
      </div>

      {/* Timeline */}
      <div className="stages">
        {STAGES.map((s) => {
          const done = Boolean(artifacts[s.id]);
          const active = loading === s.id;
          return (
            <div
              key={s.id}
              className={`stage-chip ${done ? "done" : ""} ${active ? "active" : ""}`}
              title={s.summary}
            >
              <span className="dot" />
              {s.emoji} {s.title}
            </div>
          );
        })}
      </div>

      {/* Saisie */}
      <div className="card">
        <div className="field">
          <label>
            Ton idée <span className="hint">— décris ce que tu veux construire</span>
          </label>
          <textarea
            rows={4}
            value={idea}
            placeholder="Ex : une app où les commerçants décrivent une animation et reçoivent un plan de jeu clé en main…"
            onChange={(e) => setIdea(e.target.value)}
          />
        </div>

        <div className="grid2">
          <div className="field">
            <label>
              Cible <span className="hint">— pour qui ?</span>
            </label>
            <input
              value={answers.cible || ""}
              onChange={(e) => setAnswer("cible", e.target.value)}
              placeholder="Ex : commerçants de proximité"
            />
          </div>
          <div className="field">
            <label>
              Objectif de succès <span className="hint">— à quoi ça sert ?</span>
            </label>
            <input
              value={answers.objectif || ""}
              onChange={(e) => setAnswer("objectif", e.target.value)}
              placeholder="Ex : +30 % d'avis Google en 3 mois"
            />
          </div>
          <div className="field">
            <label>
              Contrainte principale <span className="hint">— budget, délai, légal…</span>
            </label>
            <input
              value={answers.contrainte || ""}
              onChange={(e) => setAnswer("contrainte", e.target.value)}
              placeholder="Ex : conformité aux règles Google"
            />
          </div>
          <div className="field">
            <label>
              Ressources <span className="hint">— équipe, stack, budget</span>
            </label>
            <input
              value={answers.ressources || ""}
              onChange={(e) => setAnswer("ressources", e.target.value)}
              placeholder="Ex : solo, Next.js + Supabase, 0 €"
            />
          </div>
        </div>

        <div className="btn-row">
          <button
            className="btn-primary"
            disabled={!canRun("analyst") || loading !== null}
            onClick={() => runStage("analyst")}
          >
            {loading === "analyst" && <span className="spinner" />}
            {report ? "Relancer l'analyse" : "Lancer l'analyse de faisabilité"}
          </button>
          {hasAny && (
            <button className="btn-ghost" onClick={exportAll}>
              ⬇ Exporter le dossier (.md)
            </button>
          )}
        </div>
      </div>

      {error && <div className="error">⚠ {error}</div>}

      {/* Rapport de faisabilité */}
      {report && <FeasibilityView report={report} />}

      {/* Étapes suivantes de la chaîne */}
      {STAGES.filter((s) => s.id !== "analyst").map((s) => {
        const md = artifacts[s.id];
        return (
          <div className="card" key={s.id}>
            <div className="btn-row" style={{ justifyContent: "space-between" }}>
              <div>
                <div className="section-title" style={{ margin: 0 }}>
                  {s.emoji} {s.title}
                </div>
                <div className="muted">
                  {s.role} — {s.summary}
                </div>
              </div>
              <button
                className="btn-ghost"
                disabled={!canRun(s.id) || loading !== null}
                onClick={() => runStage(s.id)}
                title={
                  canRun(s.id)
                    ? ""
                    : "Termine d'abord les étapes précédentes."
                }
              >
                {loading === s.id && <span className="spinner" />}
                {md ? "Régénérer" : "Générer"}
              </button>
            </div>
            {md && (
              <div
                className="md"
                style={{ marginTop: 16 }}
                dangerouslySetInnerHTML={{ __html: marked.parse(md) as string }}
              />
            )}
          </div>
        );
      })}

      <div className="footer">
        BMAD Studio · propulsé par Claude · l'analyse est une aide à la décision,
        pas une garantie — valide toujours les hypothèses.
      </div>
    </div>
  );
}

function FeasibilityView({ report }: { report: FeasibilityReport }) {
  return (
    <div className="card">
      <div className="verdict">
        <div
          className="gauge"
          style={{ ["--v" as string]: String(report.score) }}
        >
          <span>{report.score}</span>
        </div>
        <div>
          <span className={`badge ${report.verdict}`}>{report.verdict}</span>
          <p style={{ margin: "8px 0 0" }}>{report.resume}</p>
        </div>
      </div>
      <p className="muted">{report.verdict_justification}</p>

      <div className="section-title">✅ Avantages</div>
      {report.avantages?.map((a, i) => (
        <div className="item" key={i}>
          <h4>{a.titre}</h4>
          <p>{a.detail}</p>
        </div>
      ))}

      <div className="section-title">⛓️ Contraintes</div>
      {report.contraintes?.map((c, i) => (
        <div className="item" key={i}>
          <h4>{c.titre}</h4>
          <p>{c.detail}</p>
          <div className="tags">
            <span className={`tag g-${c.gravite}`}>gravité : {c.gravite}</span>
          </div>
        </div>
      ))}

      <div className="section-title">⚠️ Risques</div>
      {report.risques?.map((x, i) => (
        <div className="item" key={i}>
          <h4>{x.titre}</h4>
          <p>{x.detail}</p>
          <div className="tags">
            <span className={`tag p-${x.probabilite}`}>
              proba : {x.probabilite}
            </span>
            <span className={`tag i-${x.impact}`}>impact : {x.impact}</span>
          </div>
          <p style={{ marginTop: 8 }}>
            <strong>Mitigation :</strong> {x.mitigation}
          </p>
        </div>
      ))}

      <div className="section-title">🧪 Hypothèses à valider</div>
      <ul className="plain">
        {report.hypotheses?.map((h, i) => (
          <li key={i}>{h}</li>
        ))}
      </ul>

      <div className="section-title">➡️ Prochaines étapes</div>
      <ul className="plain">
        {report.prochaines_etapes?.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );
}
