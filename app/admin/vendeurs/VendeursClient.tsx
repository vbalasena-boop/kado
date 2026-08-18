"use client";

import { useState } from "react";
import Link from "next/link";

export type AffiliateRow = {
  id: string;
  name: string;
  email: string | null;
  code: string;
  active: boolean;
  commissionRoue: number;
  commissionFidelite: number;
  commissionComplet: number;
  totalClients: number;
  trialClients: number;
  paidClients: number;
  dueCents: number;
  paidCents: number;
};

const eur = (cents: number) =>
  (cents / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " €";

export default function VendeursClient({
  rows: initialRows,
  tableMissing,
}: {
  rows: AffiliateRow[];
  tableMissing: boolean;
}) {
  const [rows, setRows] = useState(initialRows);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function createAffiliate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/affiliates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(
          data.error === "code_taken"
            ? "Ce code est déjà pris — choisissez-en un autre."
            : "Création impossible. Vérifiez que la migration SQL est passée."
        );
      } else {
        setMsg("Vendeur créé ✔ — la page va se recharger.");
        window.setTimeout(() => window.location.reload(), 700);
      }
    } catch {
      setMsg("Erreur réseau — réessayez.");
    }
    setCreating(false);
  }

  async function patch(id: string, action: "mark_paid" | "toggle_active") {
    try {
      const res = await fetch("/api/admin/affiliates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) return;
      if (action === "mark_paid") {
        setRows((rs) =>
          rs.map((r) =>
            r.id === id
              ? { ...r, paidCents: r.paidCents + r.dueCents, dueCents: 0 }
              : r
          )
        );
      } else {
        setRows((rs) =>
          rs.map((r) => (r.id === id ? { ...r, active: !r.active } : r))
        );
      }
    } catch {
      /* ignore */
    }
  }

  function copyLink(code: string) {
    const link = `https://kado-app.fr?ref=${code}`;
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(code);
      window.setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <>
      <h1 className="dash-h1">🤝 Vendeurs</h1>
      <p className="dash-sub">
        Vos apporteurs d'affaires. Chacun a son lien — quand un commerce
        s'inscrit via ce lien puis <b>paie son premier abonnement</b>, la
        commission fixe est créée automatiquement (jamais pendant l'essai
        gratuit). <Link href="/admin">← Retour admin</Link>
      </p>

      {tableMissing && (
        <div className="dash-card">
          <h2>⚠️ Migration SQL à passer</h2>
          <p>
            La table des vendeurs n'existe pas encore. Exécutez la migration{" "}
            <code>supabase/migrations/0032_affiliates.sql</code> dans le SQL
            Editor de Supabase, puis rechargez cette page.
          </p>
        </div>
      )}

      <div className="dash-card">
        <h2>Ajouter un vendeur</h2>
        <form onSubmit={createAffiliate} className="admin-create">
          <input
            type="text"
            required
            placeholder="Nom (ex. Paul Martin)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="email"
            placeholder="E-mail (pour le prévenir des commissions)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="text"
            placeholder="Code du lien (ex. paul) — sinon dérivé du nom"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button className="btn" disabled={creating}>
            {creating ? "Création…" : "Créer le vendeur"}
          </button>
        </form>
        {msg && <p className="save-msg">{msg}</p>}
        <p className="muted">
          Commissions par défaut : Fidélité <b>40 €</b> · Jeux <b>60 €</b> ·
          Complet <b>90 €</b> par client signé (payant).
        </p>
      </div>

      {rows.length === 0 && !tableMissing ? (
        <div className="dash-card">
          <p className="muted">
            Aucun vendeur pour l'instant. Créez le premier ci-dessus, puis
            donnez-lui son lien à partager.
          </p>
        </div>
      ) : (
        rows.map((r) => (
          <div className="dash-card" key={r.id}>
            <h2>
              {r.active ? "🟢" : "⚪️"} {r.name}{" "}
              {!r.active && <span className="muted">(désactivé)</span>}
            </h2>
            <p className="muted">
              {r.email ?? "pas d'e-mail"} · commissions : Fidélité{" "}
              {r.commissionFidelite} € · Jeux {r.commissionRoue} € · Complet{" "}
              {r.commissionComplet} €
            </p>
            <p>
              Lien : <code>kado-app.fr?ref={r.code}</code>{" "}
              <button
                type="button"
                className="btn-mini soft"
                onClick={() => copyLink(r.code)}
              >
                {copied === r.code ? "Copié ✔" : "Copier le lien"}
              </button>
            </p>
            <p>
              👥 <b>{r.totalClients}</b> client{r.totalClients > 1 ? "s" : ""}{" "}
              amené{r.totalClients > 1 ? "s" : ""} · 🧪 {r.trialClients} en
              essai · 💳 <b>{r.paidClients}</b> payant
              {r.paidClients > 1 ? "s" : ""}
            </p>
            <p>
              💶 À verser : <b>{eur(r.dueCents)}</b> · déjà versé :{" "}
              {eur(r.paidCents)}
            </p>
            <p>
              {r.dueCents > 0 && (
                <button
                  type="button"
                  className="btn-mini ok"
                  onClick={() => patch(r.id, "mark_paid")}
                >
                  ✔ Marquer {eur(r.dueCents)} comme payé
                </button>
              )}{" "}
              <button
                type="button"
                className="btn-mini soft"
                onClick={() => patch(r.id, "toggle_active")}
              >
                {r.active ? "Désactiver" : "Réactiver"}
              </button>
            </p>
          </div>
        ))
      )}
    </>
  );
}
