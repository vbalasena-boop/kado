"use client";

import { useEffect, useRef, useState } from "react";

type Biz = { id: string; name: string };

/** Sélecteur d'établissement + ajout self-service (multi-établissements).
 *  Toujours visible dès qu'il y a un établissement : permet de basculer
 *  entre boutiques ET d'en ajouter une nouvelle soi-même. */
export function BusinessSwitcher({
  businesses,
  activeId,
}: {
  businesses: Biz[];
  activeId: string;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const active = businesses.find((b) => b.id === activeId);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  async function switchTo(id: string) {
    if (id === activeId || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/dashboard/switch-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: id }),
      });
      if (res.ok) window.location.href = "/dashboard";
      else setBusy(false);
    } catch {
      setBusy(false);
    }
  }

  async function addBusiness(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/dashboard/add-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        // Nouvel établissement créé et actif → on va le configurer.
        window.location.href = "/dashboard/wheel";
      } else {
        setErr(
          d.error === "too_many"
            ? "Limite d'établissements atteinte."
            : "Création impossible. Réessayez."
        );
        setBusy(false);
      }
    } catch {
      setErr("Connexion impossible.");
      setBusy(false);
    }
  }

  return (
    <div className="biz-switcher" ref={rootRef}>
      <button
        type="button"
        className="biz-switch-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span aria-hidden="true">🏪</span>
        <b>{active?.name ?? "Établissement"}</b>
        <span className="biz-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className="biz-menu" role="menu">
          {businesses.map((b) => (
            <button
              key={b.id}
              type="button"
              role="menuitem"
              className={`biz-menu-item${b.id === activeId ? " on" : ""}`}
              onClick={() => switchTo(b.id)}
              disabled={busy}
            >
              <span className="biz-check" aria-hidden="true">
                {b.id === activeId ? "✓" : ""}
              </span>
              {b.name}
            </button>
          ))}

          <div className="biz-menu-sep" />

          {adding ? (
            <form className="biz-add-form" onSubmit={addBusiness}>
              <input
                type="text"
                autoFocus
                maxLength={80}
                placeholder="Nom du nouvel établissement"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
                aria-label="Nom du nouvel établissement"
              />
              <button type="submit" className="biz-add-go" disabled={busy || !name.trim()}>
                {busy ? "…" : "Créer"}
              </button>
              {err && <p className="biz-add-err">{err}</p>}
            </form>
          ) : (
            <button
              type="button"
              role="menuitem"
              className="biz-menu-item biz-add"
              onClick={() => setAdding(true)}
            >
              ＋ Ajouter un établissement
            </button>
          )}
        </div>
      )}
    </div>
  );
}
