"use client";

import { useState } from "react";

export type VendorStatsData = {
  name: string;
  code: string;
  commissionRoue: number;
  commissionFidelite: number;
  commissionComplet: number;
  totalClients: number;
  trialClients: number;
  paidClients: number;
  exigibleCents: number;
  pendingCents: number;
  paidCents: number;
};

const eur = (cents: number) =>
  (cents / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " €";

export default function StatsView({ data }: { data: VendorStatsData }) {
  const [copied, setCopied] = useState(false);
  const link = `https://kado-app.fr?ref=${data.code}`;

  return (
    <div className="dash">
      <header className="dash-top">
        <div className="dash-brand">🎡 Kado · Espace vendeur</div>
      </header>
      <main className="dash-main">
        <h1 className="dash-h1">🤝 Bonjour {data.name} !</h1>
        <p className="dash-sub">
          Voici vos résultats en temps réel. Gardez cette page dans vos
          favoris — le lien est personnel, ne le partagez pas.
        </p>

        <div className="dash-card">
          <h2>🔗 Votre lien à partager</h2>
          <p>
            <code>{link}</code>{" "}
            <button
              type="button"
              className="btn-mini soft"
              onClick={() =>
                navigator.clipboard?.writeText(link).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                })
              }
            >
              {copied ? "Copié ✔" : "Copier"}
            </button>
          </p>
          <p className="muted">
            Chaque commerce qui s'inscrit via ce lien vous est attribué
            (traçage 90 jours).
          </p>
        </div>

        <div className="dash-card">
          <h2>👥 Vos clients</h2>
          <p>
            <b>{data.totalClients}</b> commerce
            {data.totalClients > 1 ? "s" : ""} amené
            {data.totalClients > 1 ? "s" : ""} · 🧪 {data.trialClients} en
            essai gratuit · 💳 <b>{data.paidClients}</b> abonné
            {data.paidClients > 1 ? "s" : ""} payant
            {data.paidClients > 1 ? "s" : ""}
          </p>
        </div>

        <div className="dash-card">
          <h2>💶 Vos commissions</h2>
          <p>
            À recevoir : <b>{eur(data.exigibleCents)}</b>
            {data.exigibleCents > 0 && (
              <span className="muted">
                {" "}
                — envoyez votre facture à Kado pour le virement
              </span>
            )}
          </p>
          <p>
            ⏳ En attente du 2ᵉ prélèvement de vos clients :{" "}
            {eur(data.pendingCents)}
          </p>
          <p>✔ Déjà versé : {eur(data.paidCents)}</p>
          <p className="muted">
            Barème : Fidélité <b>{data.commissionFidelite} €</b> · Jeux{" "}
            <b>{data.commissionRoue} €</b> · Complet{" "}
            <b>{data.commissionComplet} €</b> par client signé. La commission
            est acquise au premier paiement du client et versée après son 2ᵉ
            prélèvement mensuel, sur facture.
          </p>
        </div>

        <div className="dash-card">
          <h2>📄 Vos outils</h2>
          <p>
            <a
              className="btn-mini soft"
              href="/vendeurs/plaquette-vendeur-kado.pdf"
              target="_blank"
              rel="noreferrer"
            >
              Plaquette de vente (PDF)
            </a>{" "}
            <span className="muted">
              — montrez la page 1 aux commerçants, la page 2 résume votre
              programme.
            </span>
          </p>
        </div>
      </main>
    </div>
  );
}
