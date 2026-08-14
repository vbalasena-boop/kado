"use client";

import { useState } from "react";

type Result = {
  status: string;
  prize?: string;
  redeemed_at?: string;
} | null;

const LABELS: Record<string, { txt: string; cls: string }> = {
  valid: { txt: "✅ Code valide — cadeau à remettre", cls: "ok" },
  redeemed: { txt: "✅ Cadeau remis et marqué comme utilisé", cls: "ok" },
  already: { txt: "⚠️ Code déjà utilisé", cls: "warn" },
  expired: { txt: "⏰ Code expiré", cls: "warn" },
  no_win: { txt: "❌ Ce tour n'a rien gagné", cls: "bad" },
  not_found: { txt: "❌ Code introuvable", cls: "bad" },
};

export default function ValidateClient() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<Result>(null);
  const [loading, setLoading] = useState(false);

  async function call(action: "check" | "redeem") {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, action }),
      });
      setResult(await res.json());
    } catch {
      setResult({ status: "not_found" });
    } finally {
      setLoading(false);
    }
  }

  const r = result ? LABELS[result.status] : null;

  return (
    <>
      <h1 className="dash-h1">Valider un cadeau</h1>
      <p className="dash-sub">
        Entrez le code présenté par le client pour vérifier qu'il est valide,
        puis marquez-le comme utilisé.
      </p>

      <div className="dash-card" style={{ maxWidth: 520 }}>
        <label className="field">
          <span>Code cadeau (ex. KD-4K9Q2)</span>
          <input
            type="text"
            placeholder="KD-XXXXX"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setResult(null);
            }}
            style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}
          />
        </label>

        <button
          className="btn"
          onClick={() => call("check")}
          disabled={loading || !code.trim()}
        >
          {loading ? "Vérification…" : "Vérifier"}
        </button>

        {r && (
          <div className={`redeem-result ${r.cls}`}>
            <b>{r.txt}</b>
            {result?.prize && <div className="redeem-prize">🎁 {result.prize}</div>}
            {result?.status === "already" && result.redeemed_at && (
              <div className="muted">
                Utilisé le{" "}
                {new Date(result.redeemed_at).toLocaleString("fr-FR")}
              </div>
            )}
            {result?.status === "valid" && (
              <button
                className="btn"
                style={{ marginTop: 12 }}
                onClick={() => call("redeem")}
                disabled={loading}
              >
                Marquer comme utilisé
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
