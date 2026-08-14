"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";

export type AdminBusiness = {
  id: string;
  slug: string;
  name: string;
  status: string;
  subscription_status: string;
  subscription_ends_at: string | null;
  plays: number;
  owner_email: string;
  created_at: string;
};

/** Renvoie un libellé de temps restant + s'il est expiré. */
function remaining(endsAt: string | null): { label: string; expired: boolean } {
  if (!endsAt) return { label: "illimité", expired: false };
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return { label: "expiré", expired: true };
  const days = Math.ceil(ms / 864e5);
  if (days <= 1) return { label: "moins d'1 jour", expired: false };
  if (days < 31) return { label: `${days} jours`, expired: false };
  const months = Math.floor(days / 30);
  return { label: `~${months} mois`, expired: false };
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminClient({
  businesses,
}: {
  businesses: AdminBusiness[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function createBusiness(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg(
          d.warning
            ? `⚠️ Établissement créé (essai 14 j), mais : ${d.warning}`
            : `✅ « ${name} » créé avec un essai de 14 jours. Invitation envoyée à ${email}.`
        );
        setName("");
        setEmail("");
        router.refresh();
      } else {
        setMsg("❌ " + (d.error || "Échec de la création."));
      }
    } catch {
      setMsg("❌ Connexion impossible.");
    } finally {
      setCreating(false);
    }
  }

  async function setStatus(id: string, status: "active" | "suspended") {
    setBusyId(id);
    try {
      await fetch(`/api/admin/business/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function subscribe(id: string, action: "trial" | "month1" | "month6") {
    setBusyId(id);
    try {
      await fetch(`/api/admin/business/${id}/subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string, name: string) {
    if (
      !confirm(
        `Supprimer définitivement « ${name} » ?\nCette action est irréversible (roue, cadeaux et tours joués seront effacés).`
      )
    )
      return;
    setBusyId(id);
    try {
      await fetch(`/api/admin/business/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <h1 className="dash-h1">Gestion des comptes</h1>
      <p className="dash-sub">
        Créez des établissements, gérez leur abonnement et leurs accès. L'accès à
        la roue se coupe automatiquement quand l'abonnement expire.
      </p>

      <div className="dash-card">
        <h2>Créer un compte commerçant</h2>
        <form onSubmit={createBusiness} className="admin-create">
          <input
            type="text"
            required
            placeholder="Nom du commerce (ex. Salon Éléonore)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="email"
            required
            placeholder="E-mail du commerçant"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn" disabled={creating}>
            <Icon name="add" size={18} />
            {creating ? "Création…" : "Créer + inviter"}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 8 }}>
          Chaque nouveau compte démarre avec un <b>essai gratuit de 14 jours</b>.
        </p>
        {msg && <p className="save-msg" style={{ marginTop: 12 }}>{msg}</p>}
      </div>

      <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Établissement</th>
                <th>Propriétaire</th>
                <th>Tours</th>
                <th>Abonnement</th>
                <th>Statut</th>
                <th>Gérer l'abonnement</th>
                <th>Accès</th>
              </tr>
            </thead>
            <tbody>
              {businesses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted" style={{ padding: 22 }}>
                    Aucun établissement pour l'instant.
                  </td>
                </tr>
              ) : (
                businesses.map((b) => {
                  const rem = remaining(b.subscription_ends_at);
                  const busy = busyId === b.id;
                  return (
                    <tr key={b.id}>
                      <td>
                        <b>{b.name}</b>
                        <br />
                        <a
                          href={`/${b.slug}`}
                          target="_blank"
                          className="admin-slug"
                        >
                          /{b.slug} ↗
                        </a>
                      </td>
                      <td className="admin-email">{b.owner_email}</td>
                      <td>{b.plays}</td>
                      <td>
                        <div>{b.subscription_status}</div>
                        <small
                          className={rem.expired ? "sub-expired" : "sub-ok"}
                        >
                          {rem.expired ? "⏰ expiré" : `${rem.label} restants`}
                          <br />
                          <span className="admin-email">
                            {fmtDate(b.subscription_ends_at)}
                          </span>
                        </small>
                      </td>
                      <td>
                        <span
                          className={`pill ${
                            rem.expired ? "suspended" : b.status
                          }`}
                        >
                          {b.status === "suspended"
                            ? "Suspendu"
                            : rem.expired
                            ? "Expiré"
                            : "Actif"}
                        </span>
                      </td>
                      <td>
                        <div className="sub-actions">
                          <button
                            className="btn-mini soft"
                            disabled={busy}
                            onClick={() => subscribe(b.id, "trial")}
                          >
                            <Icon name="event" size={15} /> Essai 14 j
                          </button>
                          <button
                            className="btn-mini ok"
                            disabled={busy}
                            onClick={() => subscribe(b.id, "month1")}
                          >
                            <Icon name="add" size={15} /> 1 mois
                          </button>
                          <button
                            className="btn-mini ok"
                            disabled={busy}
                            onClick={() => subscribe(b.id, "month6")}
                          >
                            <Icon name="add" size={15} /> 6 mois
                          </button>
                        </div>
                      </td>
                      <td>
                        <div className="sub-actions">
                          {b.status === "active" ? (
                            <button
                              className="btn-mini danger"
                              disabled={busy}
                              onClick={() => setStatus(b.id, "suspended")}
                            >
                              <Icon name="block" size={15} /> Suspendre
                            </button>
                          ) : (
                            <button
                              className="btn-mini ok"
                              disabled={busy}
                              onClick={() => setStatus(b.id, "active")}
                            >
                              <Icon name="check" size={15} /> Réactiver
                            </button>
                          )}
                          <button
                            className="btn-mini danger"
                            disabled={busy}
                            onClick={() => remove(b.id, b.name)}
                          >
                            <Icon name="delete" size={15} /> Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
