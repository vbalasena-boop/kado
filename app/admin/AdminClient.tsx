"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type AdminBusiness = {
  id: string;
  slug: string;
  name: string;
  status: string;
  subscription_status: string;
  plays: number;
  owner_email: string;
  created_at: string;
};

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
            ? `⚠️ Établissement créé, mais : ${d.warning}`
            : `✅ Établissement « ${name} » créé. Un e-mail d'invitation a été envoyé à ${email}.`
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

  return (
    <>
      <h1 className="dash-h1">Gestion des comptes</h1>
      <p className="dash-sub">
        Créez des établissements et gérez leurs accès. Suspendre coupe la page de
        jeu <b>et</b> l'espace du commerçant ; réactiver restaure tout.
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
            {creating ? "Création…" : "Créer + inviter"}
          </button>
        </form>
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
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {businesses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted" style={{ padding: 22 }}>
                    Aucun établissement pour l'instant.
                  </td>
                </tr>
              ) : (
                businesses.map((b) => (
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
                    <td>{b.subscription_status}</td>
                    <td>
                      <span className={`pill ${b.status}`}>
                        {b.status === "active" ? "Actif" : "Suspendu"}
                      </span>
                    </td>
                    <td>
                      {b.status === "active" ? (
                        <button
                          className="btn-mini danger"
                          disabled={busyId === b.id}
                          onClick={() => setStatus(b.id, "suspended")}
                        >
                          Suspendre
                        </button>
                      ) : (
                        <button
                          className="btn-mini ok"
                          disabled={busyId === b.id}
                          onClick={() => setStatus(b.id, "active")}
                        >
                          Réactiver
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
