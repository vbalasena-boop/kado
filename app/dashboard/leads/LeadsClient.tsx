"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

export type Lead = {
  email: string | null;
  phone: string | null;
  created_at: string;
};

export default function LeadsClient({
  initialLeads,
  total,
  pageSize,
}: {
  initialLeads: Lead[];
  total: number;
  pageSize: number;
}) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [loading, setLoading] = useState(false);
  const hasMore = leads.length < total;

  async function loadMore() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/leads?offset=${leads.length}`);
      if (res.ok) {
        const json = (await res.json()) as { leads?: Lead[] };
        setLeads((prev) => [...prev, ...(json.leads ?? [])]);
      }
    } catch {
      /* réseau : on laisse l'utilisateur réessayer */
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="dash-h1">Clients collectés</h1>
      <p className="dash-sub">
        Les e-mails laissés par tes joueurs (avec leur consentement). Active la
        collecte dans <b>Mon jeu</b> si ce n'est pas déjà fait.
      </p>

      {total === 0 ? (
        <div className="dash-card empty-state">
          <div className="empty-emoji">📭</div>
          <h2>Aucun client collecté pour l'instant</h2>
          <p>
            Dès qu'un joueur laissera son e-mail après avoir gagné, il
            apparaîtra ici — prêt à recevoir vos offres et campagnes.
          </p>
          <a href="/dashboard/wheel" className="btn">
            Activer la collecte dans Mon jeu →
          </a>
        </div>
      ) : (
        <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="leads-head">
            <div>
              <b>{total}</b> contact{total > 1 ? "s" : ""}
            </div>
            {/* Export COMPLET (toute la base) servi par la route dédiée. */}
            <a
              className="btn-secondary"
              href="/api/dashboard/leads/export"
              style={{ textDecoration: "none" }}
            >
              <Icon name="download" size={16} /> Exporter en CSV
            </a>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>E-mail</th>
                  <th>Téléphone</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l, i) => (
                  <tr key={i}>
                    <td>{l.email || "—"}</td>
                    <td>{l.phone || "—"}</td>
                    <td className="admin-email">
                      {new Date(l.created_at).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div style={{ padding: 16, textAlign: "center" }}>
              <button
                className="btn-secondary"
                onClick={loadMore}
                disabled={loading}
              >
                {loading
                  ? "Chargement…"
                  : `Charger plus (${leads.length} / ${total})`}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
