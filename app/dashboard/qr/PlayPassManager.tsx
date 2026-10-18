"use client";

import { useEffect, useState } from "react";

type Props = { initialRequired: boolean };

export default function PlayPassManager({ initialRequired }: Props) {
  const [required, setRequired] = useState(initialRequired);
  const [available, setAvailable] = useState(0);
  const [count, setCount] = useState(20);
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    try {
      const res = await fetch("/api/dashboard/play-passes");
      if (!res.ok) return;
      const data = await res.json();
      setRequired(!!data.required);
      setAvailable(Number(data.available) || 0);
    } catch {
      /* le tableau de bord reste utilisable si le compteur ne charge pas */
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function generate() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/dashboard/play-passes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", count }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error("Création impossible. Réessayez.");
      setCodes(data.codes ?? []);
      setMessage(`${data.codes?.length ?? 0} codes créés. Ils sont valables 90 jours.`);
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleRequired(next: boolean) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/dashboard/play-passes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-required", required: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error === "no_available_passes"
          ? "Créez d'abord des codes valides avant d'activer leur utilisation obligatoire."
          : "Réglage impossible. Réessayez.");
      }
      setRequired(!!data.required);
      setMessage(next ? "Le code est maintenant demandé avant chaque tour." : "Le code n'est plus obligatoire.");
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Réglage impossible.");
    } finally {
      setBusy(false);
    }
  }

  function downloadCsv() {
    const csv = `Code de jeu\n${codes.join("\n")}\n`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "codes-jeu-kado.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="dash-card">
      <h2>🎟️ Codes de jeu à usage unique</h2>
      <p className="muted">
        Remettez un code au client en caisse avant qu'il scanne votre QR. Chaque code permet un seul tour et expire après 90 jours.
      </p>

      <div className="play-pass-controls">
        <label className="play-pass-toggle">
          <input
            type="checkbox"
            checked={required}
            disabled={busy || (available === 0 && !required)}
            onChange={(e) => void toggleRequired(e.target.checked)}
          />
          <span>Demander un code avant chaque tour</span>
        </label>
        <span className="play-pass-count">{available} code{available === 1 ? "" : "s"} disponible{available === 1 ? "" : "s"}</span>
      </div>

      <div className="play-pass-generate">
        <label htmlFor="play-pass-count">Créer une série</label>
        <input
          id="play-pass-count"
          className="input"
          type="number"
          min={1}
          max={100}
          value={count}
          onChange={(e) => setCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
        />
        <button className="btn" type="button" disabled={busy} onClick={() => void generate()}>
          {busy ? "Patientez…" : "Générer les codes"}
        </button>
      </div>

      {message && <p className="play-pass-message" role="status">{message}</p>}
      {codes.length > 0 && (
        <div className="play-pass-output">
          <p><b>Enregistrez ou imprimez cette série maintenant.</b> Les codes ne pourront plus être affichés après avoir quitté cette page.</p>
          <div className="play-pass-code-grid">
            {codes.map((code) => <code key={code}>{code}</code>)}
          </div>
          <button className="btn-secondary" type="button" onClick={downloadCsv}>Télécharger le CSV</button>
          <button className="btn-secondary" type="button" onClick={() => window.print()}>Imprimer</button>
        </div>
      )}
    </section>
  );
}
