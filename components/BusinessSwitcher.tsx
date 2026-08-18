"use client";

import { useState } from "react";

type Biz = { id: string; name: string };

/** Sélecteur d'établissement actif — visible seulement si le commerçant
 *  en gère plusieurs (multi-établissements). */
export function BusinessSwitcher({
  businesses,
  activeId,
}: {
  businesses: Biz[];
  activeId: string;
}) {
  const [busy, setBusy] = useState(false);
  if (!businesses || businesses.length < 2) return null;

  async function switchTo(id: string) {
    if (id === activeId || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/dashboard/switch-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: id }),
      });
      if (res.ok) {
        // Recharge pour que tout l'espace pointe sur le nouvel établissement.
        window.location.href = "/dashboard";
      } else {
        setBusy(false);
      }
    } catch {
      setBusy(false);
    }
  }

  return (
    <label className="biz-switcher" title="Changer d'établissement">
      <span aria-hidden="true">🏪</span>
      <select
        value={activeId}
        onChange={(e) => switchTo(e.target.value)}
        disabled={busy}
        aria-label="Établissement actif"
      >
        {businesses.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}
