"use client";

import { Icon } from "@/components/icons";

export type Lead = {
  email: string | null;
  phone: string | null;
  created_at: string;
};

export default function LeadsClient({ leads }: { leads: Lead[] }) {
  function exportCsv() {
    const rows = [
      ["email", "telephone", "date"],
      ...leads.map((l) => [
        l.email ?? "",
        l.phone ?? "",
        new Date(l.created_at).toISOString(),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clients-kado.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <h1 className="dash-h1">Clients collectés</h1>
      <p className="dash-sub">
        Les e-mails laissés par tes joueurs (avec leur consentement). Active la
        collecte dans <b>Mon jeu</b> si ce n'est pas déjà fait.
      </p>

      {leads.length === 0 ? (
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
              <b>{leads.length}</b> contact{leads.length > 1 ? "s" : ""}
            </div>
            <button className="btn-secondary" onClick={exportCsv}>
              <Icon name="download" size={16} /> Exporter en CSV
            </button>
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
        </div>
      )}
    </>
  );
}
