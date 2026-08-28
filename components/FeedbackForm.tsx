"use client";

import { useState } from "react";

/**
 * Feedback privé « avant Google » — proposé à TOUS les clients (jamais
 * conditionné à une note). Replié par défaut ; s'ouvre au clic. Ne s'affiche
 * que si le commerçant a activé la fonctionnalité.
 */
export default function FeedbackForm({
  slug,
  enabled = false,
}: {
  slug: string;
  enabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");

  if (!enabled) return null;

  async function send() {
    if (!message.trim()) return;
    setState("busy");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, message, email }),
      });
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div className="feedback-box" role="status">
        <b>🙏 Merci pour votre retour !</b>
        <p>Nous en prenons note et reviendrons vers vous si besoin.</p>
      </div>
    );
  }

  return (
    <div className="feedback-box">
      {!open ? (
        <button className="feedback-open" onClick={() => setOpen(true)}>
          💬 Un souci ? Dites-le nous
        </button>
      ) : (
        <>
          <b>Dites-nous tout 👂</b>
          <p className="feedback-sub">
            Votre message est privé, il n'est PAS publié. Il nous aide à nous
            améliorer.
          </p>
          <textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Qu'est-ce qui n'a pas été ?"
          />
          <input
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Votre e-mail (facultatif, pour vous répondre)"
          />
          {state === "error" && (
            <p className="feedback-err">Envoi impossible. Réessayez.</p>
          )}
          <button
            className="feedback-send"
            onClick={send}
            disabled={state === "busy" || !message.trim()}
          >
            {state === "busy" ? "Envoi…" : "Envoyer"}
          </button>
        </>
      )}
    </div>
  );
}
