"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProspectStatus } from "@/lib/prospection/types";

export type ProspectDetail = {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  address: string | null;
  google_rating: number | null;
  google_reviews_count: number | null;
  website: string | null;
  instagram_handle: string | null;
  email: string | null;
  score: number | null;
  score_factors: { factors?: { key: string; points: number; reason: string }[] } | null;
  status: ProspectStatus;
  note: string | null;
};

export type MessageRow = {
  id: string;
  channel: "email" | "instagram";
  step: number;
  subject: string | null;
  body: string;
  status: string;
};

export type EventRow = {
  id: string;
  type: string;
  meta: Record<string, unknown> | null;
  created_at: string;
};

export default function ProspectDetailClient({
  prospect,
  messages,
  events,
}: {
  prospect: ProspectDetail;
  messages: MessageRow[];
  events: EventRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [spamFlags, setSpamFlags] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const email = messages.find((m) => m.channel === "email" && m.step === 1);
  const dm = messages.find((m) => m.channel === "instagram" && m.step === 1);

  /** Rédige ce prospect avec l'IA (brouillon), en reprenant la tonalité choisie. */
  async function aiGenerate() {
    setAiBusy(true);
    setMsg(null);
    let tone: string | undefined;
    try {
      tone = window.localStorage.getItem("kado_ai_tone") || undefined;
    } catch {
      /* ignore */
    }
    try {
      const res = await fetch("/api/admin/prospection/ai-write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId: prospect.id, tone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(`Erreur : ${data.error ?? "inconnue"}`);
      } else if (!data.configured) {
        setMsg("IA non configurée (ANTHROPIC_API_KEY manquante dans Vercel).");
      } else if (data.written > 0) {
        setMsg("✨ Message rédigé par l'IA. Relis puis approuve.");
        router.refresh();
      } else {
        setMsg("L'IA n'a pas pu écrire (repli possible : « Régénérer »).");
      }
    } catch {
      setMsg("Erreur réseau (rédaction IA).");
    } finally {
      setAiBusy(false);
    }
  }

  async function deleteProspect() {
    if (!window.confirm(`Supprimer définitivement « ${prospect.name} » ? Cette action est irréversible.`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/prospection/${prospect.id}/delete`, {
        method: "POST",
      });
      if (res.ok) {
        router.push("/admin/prospection");
      } else {
        const data = await res.json().catch(() => ({}));
        setMsg(`Erreur : ${data.error ?? "suppression impossible"}`);
        setBusy(false);
      }
    } catch {
      setMsg("Erreur réseau (suppression).");
      setBusy(false);
    }
  }

  async function generate() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/prospection/${prospect.id}/generate`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setSpamFlags(data.spam?.flags ?? []);
        setMsg("Messages générés.");
        router.refresh();
      } else setMsg(`Erreur : ${data.error ?? "inconnue"}`);
    } catch {
      setMsg("Erreur réseau.");
    } finally {
      setBusy(false);
    }
  }

  const factors = prospect.score_factors?.factors ?? [];

  return (
    <div className="dash-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <Link href="/admin/prospection">← Retour à la prospection</Link>
        <button
          onClick={deleteProspect}
          disabled={busy || aiBusy}
          className="dash-signout"
          style={{ fontSize: 13, color: "#c0392b" }}
          title="Supprimer définitivement ce prospect"
        >
          🗑️ Supprimer
        </button>
      </div>
      <h2 style={{ marginBottom: 4 }}>{prospect.name}</h2>
      <p style={{ color: "#666", marginTop: 0 }}>
        {prospect.city ?? "—"}
        {prospect.address ? ` · ${prospect.address}` : ""}
      </p>

      {/* Signaux */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "12px 0" }}>
        <Signal label="Score" value={prospect.score != null ? String(prospect.score) : "—"} />
        <Signal label="Note Google" value={prospect.google_rating != null ? String(prospect.google_rating) : "—"} />
        <Signal label="Avis Google" value={prospect.google_reviews_count != null ? String(prospect.google_reviews_count) : "—"} />
        <Signal label="Email" value={prospect.email ?? "—"} />
        <Signal
          label="Instagram"
          value={prospect.instagram_handle ? `@${prospect.instagram_handle}` : "—"}
        />
      </div>

      <ContactEditor
        id={prospect.id}
        email={prospect.email}
        handle={prospect.instagram_handle}
      />

      {factors.length > 0 && (
        <details style={{ marginBottom: 12 }}>
          <summary style={{ cursor: "pointer", color: "#555" }}>
            Détail du score
          </summary>
          <ul style={{ fontSize: 14, color: "#555" }}>
            {factors.map((f) => (
              <li key={f.key}>
                <b>+{f.points}</b> — {f.reason}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "10px 0" }}>
        <button onClick={generate} disabled={busy || aiBusy} className="dash-signout">
          {busy ? "Génération…" : email || dm ? "Régénérer les messages" : "Générer les messages"}
        </button>
        <button
          onClick={aiGenerate}
          disabled={busy || aiBusy}
          className="dash-signout"
          style={{ color: "#8b6cff" }}
          title="Rédige ce prospect avec l'IA (brouillon). Nécessite ANTHROPIC_API_KEY."
        >
          {aiBusy ? "Rédaction IA…" : "✨ Rédiger avec l'IA"}
        </button>
        {msg && <span style={{ fontSize: 14, color: "#333" }}>{msg}</span>}
      </div>

      {spamFlags.length > 0 && (
        <div
          style={{
            background: "#fff4e5",
            border: "1px solid #ffd8a8",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 14,
            marginBottom: 12,
          }}
        >
          ⚠️ Anti-spam : {spamFlags.join(" · ")}
        </div>
      )}

      {/* Historique */}
      <Timeline events={events} />

      {/* Messages */}
      {!email && !dm ? (
        <p style={{ color: "#666" }}>
          Aucun message encore. Clique sur « Générer les messages ».
        </p>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {email && <EmailEditor message={email} />}
          {dm && <DmEditor message={dm} instagramHandle={prospect.instagram_handle} />}
        </div>
      )}
    </div>
  );
}

function ContactEditor({
  id,
  email,
  handle,
}: {
  id: string;
  email: string | null;
  handle: string | null;
}) {
  const router = useRouter();
  const [em, setEm] = useState(email ?? "");
  const [ig, setIg] = useState(handle ?? "");
  const [saved, setSaved] = useState<string | null>(null);

  async function save() {
    setSaved(null);
    const res = await fetch(`/api/admin/prospection/${id}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: em, instagram_handle: ig }),
    });
    if (res.ok) {
      setSaved("Enregistré ✅");
      router.refresh();
    } else setSaved("Erreur");
  }

  return (
    <details style={{ margin: "8px 0 12px" }}>
      <summary style={{ cursor: "pointer", color: "#555" }}>
        ✏️ Compléter le contact à la main
      </summary>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
        <input
          value={em}
          onChange={(e) => setEm(e.target.value)}
          placeholder="email@commerce.fr"
          style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc", minWidth: 220 }}
        />
        <input
          value={ig}
          onChange={(e) => setIg(e.target.value)}
          placeholder="@instagram"
          style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc", minWidth: 160 }}
        />
        <button onClick={save} className="dash-signout" style={{ fontSize: 13 }}>
          Enregistrer le contact
        </button>
        {saved && <span style={{ fontSize: 13, color: "#555" }}>{saved}</span>}
      </div>
    </details>
  );
}

const EVENT_LABEL: Record<string, string> = {
  sourced: "Sourcé (ajouté depuis Google)",
  scored: "Score calculé",
  enriched: "Enrichi (email / Instagram)",
  contact_edited: "Contact modifié à la main",
  messages_generated: "Messages générés",
  email_sent: "Email envoyé",
  email_followup_sent: "Relance envoyée",
  email_bounced: "Email rejeté (bounce)",
  email_invalid: "Adresse invalide (écartée avant envoi)",
  email_replied: "A répondu par email",
  meeting_booked: "RDV réservé (Calendly) → Intéressé",
  dm_sent: "DM Instagram envoyé",
  status_changed: "Statut modifié",
  excluded: "Exclu",
  unsubscribed: "Désinscrit",
};

function Timeline({ events }: { events: EventRow[] }) {
  if (events.length === 0) return null;
  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };
  return (
    <details style={{ margin: "8px 0 16px" }}>
      <summary style={{ cursor: "pointer", color: "#555" }}>
        🕒 Historique ({events.length})
      </summary>
      <ul style={{ fontSize: 14, color: "#555", listStyle: "none", paddingLeft: 0 }}>
        {events.map((e) => (
          <li key={e.id} style={{ padding: "4px 0", borderBottom: "1px solid #f2f2f2" }}>
            <span style={{ color: "#999", marginRight: 8 }}>{fmt(e.created_at)}</span>
            {EVENT_LABEL[e.type] ?? e.type}
            {e.type === "status_changed" && e.meta?.status
              ? ` → ${String(e.meta.status)}`
              : ""}
          </li>
        ))}
      </ul>
    </details>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 90 }}>
      <div style={{ fontSize: 12, color: "#888" }}>{label}</div>
      <div style={{ fontWeight: 600, wordBreak: "break-all" }}>{value}</div>
    </div>
  );
}

function EmailEditor({ message }: { message: MessageRow }) {
  const [subject, setSubject] = useState(message.subject ?? "");
  const [body, setBody] = useState(message.body);
  const [saved, setSaved] = useState<string | null>(null);

  async function save(status?: "approved") {
    const res = await fetch(`/api/admin/prospection/message/${message.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body, status }),
    });
    setSaved(res.ok ? (status ? "Approuvé ✅" : "Enregistré ✅") : "Erreur");
  }

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 14 }}>
      <h3 style={{ marginTop: 0 }}>✉️ Email {statusBadge(message.status)}</h3>
      {message.status === "sent" && (
        <p style={{ fontSize: 13, color: "#a86b00", background: "#fff4e0", borderRadius: 8, padding: "8px 10px", margin: "0 0 10px" }}>
          ✅ Cet email a déjà été envoyé — « Régénérer » ne le modifie pas. Pour tester une nouvelle version, ajoute un autre prospect.
        </p>
      )}
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Objet"
        style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ccc", marginBottom: 8 }}
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={12}
        style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ccc", fontFamily: "inherit" }}
      />
      <p style={{ fontSize: 12, color: "#888" }}>
        Le marqueur <code>{"{{unsubscribe_url}}"}</code> deviendra le vrai lien de
        désinscription à l'envoi.
      </p>
      <Actions onSave={() => save()} onApprove={() => save("approved")} saved={saved} />
    </div>
  );
}

function DmEditor({
  message,
  instagramHandle,
}: {
  message: MessageRow;
  instagramHandle: string | null;
}) {
  const [body, setBody] = useState(message.body);
  const [saved, setSaved] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handle = (instagramHandle ?? "").replace(/^@/, "").trim();
  // ig.me/m/<compte> ouvre directement la conversation DM (connecté).
  const dmUrl = handle ? `https://ig.me/m/${handle}` : null;

  async function copyDm() {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function save(status?: "approved") {
    const res = await fetch(`/api/admin/prospection/message/${message.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, status }),
    });
    setSaved(res.ok ? (status ? "Approuvé ✅" : "Enregistré ✅") : "Erreur");
  }

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 14 }}>
      <h3 style={{ marginTop: 0 }}>📸 DM Instagram {statusBadge(message.status)}</h3>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={8}
        style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ccc", fontFamily: "inherit" }}
      />
      {/* Envoi manuel assisté : copier le texte, puis ouvrir le DM Instagram. */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "8px 0 0" }}>
        <button onClick={copyDm} className="dash-signout" style={{ fontSize: 13 }}>
          {copied ? "Copié ✅" : "📋 Copier le DM"}
        </button>
        {dmUrl ? (
          <a
            href={dmUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="dash-signout"
            style={{ fontSize: 13, textDecoration: "none", display: "inline-block" }}
          >
            📸 Ouvrir le DM (@{handle})
          </a>
        ) : (
          <span style={{ fontSize: 12, color: "#999" }}>
            Pas de compte Instagram sur cette fiche.
          </span>
        )}
      </div>
      <p style={{ fontSize: 12, color: "#888", margin: "6px 0 0" }}>
        Astuce : « Copier le DM » puis « Ouvrir le DM » → tu colles et tu envoies
        (Instagram ne permet pas de pré-remplir le message).
      </p>
      <Actions onSave={() => save()} onApprove={() => save("approved")} saved={saved} />
    </div>
  );
}

function Actions({
  onSave,
  onApprove,
  saved,
}: {
  onSave: () => void;
  onApprove: () => void;
  saved: string | null;
}) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
      <button onClick={onSave} className="dash-signout" style={{ fontSize: 13 }}>
        Enregistrer
      </button>
      <button onClick={onApprove} className="dash-signout" style={{ fontSize: 13, color: "#2e7d32" }}>
        Approuver
      </button>
      {saved && <span style={{ fontSize: 13, color: "#555" }}>{saved}</span>}
    </div>
  );
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft: "brouillon",
    approved: "approuvé",
    sent: "envoyé",
    skipped: "ignoré",
  };
  return (
    <span style={{ fontSize: 12, color: "#888", fontWeight: 400 }}>
      ({map[status] ?? status})
    </span>
  );
}
