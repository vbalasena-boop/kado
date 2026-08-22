"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TakeNumber({
  slug,
  name,
}: {
  slug: string;
  name: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function take() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/order/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.code) {
        router.push(`/${slug}/suivi/${d.code}`);
      } else if (res.status === 429) {
        setErr("Un instant, puis réessayez.");
        setBusy(false);
      } else {
        setErr("Suivi indisponible pour le moment.");
        setBusy(false);
      }
    } catch {
      setErr("Erreur réseau. Réessayez.");
      setBusy(false);
    }
  }

  return (
    <main className="uber">
      <div className="uber-done" style={{ paddingTop: 40 }}>
        <div className="uber-done-emoji">🎫</div>
        <h1>Suivez votre commande</h1>
        <p>
          Chez <b>{name}</b> — prenez votre numéro, suivez l'avancement et
          soyez prévenu dès que c'est prêt. Aucune application à installer.
        </p>
        <button
          type="button"
          className="uber-submit"
          style={{ maxWidth: 420, fontSize: 19 }}
          disabled={busy}
          onClick={take}
        >
          {busy ? "Un instant…" : "🎫 Prendre mon numéro"}
        </button>
        {err && <p className="uber-err">{err}</p>}
        <p className="uber-fine">
          Vous recevrez votre numéro à donner au comptoir, puis une alerte
          quand votre commande est prête.
        </p>
      </div>
    </main>
  );
}
