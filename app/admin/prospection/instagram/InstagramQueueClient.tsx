"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProspectStatus } from "@/lib/prospection/types";

export type DmItem = {
  id: string;
  name: string;
  handle: string;
  status: ProspectStatus;
  dm: string;
};

export default function InstagramQueueClient({ items }: { items: DmItem[] }) {
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const pending = items.filter((i) => i.status !== "dm_sent");
  const sent = items.filter((i) => i.status === "dm_sent");

  async function copy(item: DmItem) {
    try {
      await navigator.clipboard.writeText(item.dm);
      setCopied(item.id);
      setTimeout(() => setCopied((c) => (c === item.id ? null : c)), 2000);
    } catch {
      setCopied(null);
    }
  }

  async function markSent(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/prospection/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "dm_sent" }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="dash-card">
      <p>
        <Link href="/admin/prospection">← Retour à la prospection</Link>
      </p>
      <h2 style={{ marginBottom: 4 }}>📸 File Instagram (envoi assisté)</h2>
      <p style={{ color: "#666", marginTop: 0 }}>
        Copie le message, ouvre le profil, colle et envoie depuis <b>ton</b> compte,
        puis clique « Marqué envoyé ». Aucun envoi automatique (sécurité du compte).
      </p>

      <p style={{ fontSize: 14, color: "#555" }}>
        {pending.length} à envoyer · {sent.length} envoyé(s)
      </p>

      {pending.length === 0 ? (
        <p style={{ color: "#666" }}>
          Aucun DM en attente. Enrichis des prospects (pour récupérer leur Instagram)
          depuis la page prospection.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {pending.map((item) => (
            <div
              key={item.id}
              style={{ border: "1px solid #eee", borderRadius: 10, padding: 14 }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <b>{item.name}</b>
                <span style={{ color: "#888", fontSize: 13 }}>@{item.handle}</span>
                <a
                  href={`https://instagram.com/${item.handle}`}
                  target="_blank"
                  rel="noreferrer"
                  className="dash-signout"
                  style={{ fontSize: 13, marginLeft: "auto" }}
                >
                  Ouvrir le profil ↗
                </a>
              </div>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  background: "#faf9fc",
                  border: "1px solid #eee",
                  borderRadius: 8,
                  padding: 10,
                  fontFamily: "inherit",
                  fontSize: 14,
                  margin: "10px 0",
                }}
              >
                {item.dm}
              </pre>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button onClick={() => copy(item)} className="dash-signout" style={{ fontSize: 13 }}>
                  {copied === item.id ? "Copié ✅" : "Copier le message"}
                </button>
                <button
                  onClick={() => markSent(item.id)}
                  disabled={busy === item.id}
                  className="dash-signout"
                  style={{ fontSize: 13, color: "#2e7d32" }}
                >
                  {busy === item.id ? "…" : "Marqué envoyé"}
                </button>
                <Link
                  href={`/admin/prospection/${item.id}`}
                  style={{ fontSize: 13, marginLeft: "auto" }}
                >
                  Éditer
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
