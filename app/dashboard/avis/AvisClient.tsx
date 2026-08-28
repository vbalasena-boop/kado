"use client";

import { useState } from "react";
import {
  draftReviewReply,
  type ReviewReplyKind,
  type ReviewReplyTone,
} from "@/lib/review-reply";

const KINDS: { id: ReviewReplyKind; label: string }[] = [
  { id: "negatif", label: "Négatif" },
  { id: "mitige", label: "Mitigé" },
  { id: "positif", label: "Positif" },
];
const TONES: { id: ReviewReplyTone; label: string }[] = [
  { id: "sobre", label: "Sobre" },
  { id: "chaleureux", label: "Chaleureux" },
];

export default function AvisClient({ shopName }: { shopName: string }) {
  const [review, setReview] = useState("");
  const [kind, setKind] = useState<ReviewReplyKind>("negatif");
  const [tone, setTone] = useState<ReviewReplyTone>("sobre");
  const [author, setAuthor] = useState("");
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);

  function generate() {
    setDraft(draftReviewReply({ shopName, kind, tone, authorName: author }));
    setCopied(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* copie indisponible : le texte reste sélectionnable */
    }
  }

  return (
    <div className="dash-card">
      <h2>Assistant de réponse</h2>
      <p className="muted">
        Collez l'avis (pour référence), choisissez le type et le ton, et obtenez
        un brouillon courtois à personnaliser avant de le publier sur Google.
      </p>

      <label className="field">
        <span>L'avis (facultatif, pour vous aider à rédiger)</span>
        <textarea
          rows={3}
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="Collez ici le texte de l'avis…"
        />
      </label>

      <div className="avis-controls">
        <label className="field">
          <span>Type d'avis</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as ReviewReplyKind)}>
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Ton</span>
          <select value={tone} onChange={(e) => setTone(e.target.value as ReviewReplyTone)}>
            {TONES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Prénom du client (facultatif)</span>
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="ex. Marc"
          />
        </label>
      </div>

      <button className="btn" onClick={generate}>
        ✍️ Générer un brouillon
      </button>

      {draft && (
        <div className="avis-draft">
          <label className="field">
            <span>Brouillon (modifiable)</span>
            <textarea
              rows={8}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <button className="btn-secondary" onClick={copy}>
            {copied ? "✅ Copié !" : "📋 Copier"}
          </button>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
            Relisez et personnalisez toujours avant de publier. Ne mentionnez
            jamais de données personnelles du client dans une réponse publique.
          </p>
        </div>
      )}
    </div>
  );
}
