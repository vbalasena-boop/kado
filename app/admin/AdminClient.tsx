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
  phone: string | null;
  address: string | null;
  plan: string | null;
  setup_option: string | null;
  setup_paid_at: string | null;
  setup_done_at: string | null;
  admin_note: string | null;
};

const PLAN_LABEL: Record<string, string> = {
  roue: "Jeux 29 €",
  fidelite: "Fidélité 19 €",
  complet: "Complet 44 €",
};

export type AdminStats = {
  bizTotal: number;
  bizActive: number;
  bizTrial: number;
  bizSuspended: number;
  playsTotal: number;
  playsMonth: number;
  playsToday: number;
  insta: number;
  review: number;
  won: number;
  redeemed: number;
  leads: number;
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
  stats,
}: {
  businesses: AdminBusiness[];
  stats: AdminStats;
}) {
  const redemptionRate =
    stats.won > 0 ? Math.round((stats.redeemed / stats.won) * 100) : 0;
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

  async function markSetupDone(id: string, name: string) {
    if (!confirm(`Marquer l'installation de « ${name} » comme réalisée ?`))
      return;
    setBusyId(id);
    try {
      await fetch(`/api/admin/business/${id}/setup-done`, { method: "POST" });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function saveNote(id: string, current: string | null) {
    const note = window.prompt(
      "Note interne (visible uniquement par vous) :",
      current ?? ""
    );
    if (note === null) return;
    setBusyId(id);
    try {
      await fetch(`/api/admin/business/${id}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function resetCounters(id: string, name: string) {
    if (
      !confirm(
        `Remettre les compteurs de « ${name} » à zéro ?\n\nSupprime tous les tours joués et leurs codes cadeaux (utile après vos tests d'installation). Les cartes de fidélité et e-mails capturés sont conservés.`
      )
    )
      return;
    setBusyId(id);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/business/${id}/reset`, {
        method: "POST",
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg(
          `✅ Compteurs de « ${name} » remis à zéro (${d.deleted ?? 0} tour${
            (d.deleted ?? 0) > 1 ? "s" : ""
          } supprimé${(d.deleted ?? 0) > 1 ? "s" : ""}). Rechargement…`
        );
        // rechargement complet pour rafraîchir toutes les statistiques
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setMsg("❌ Échec de la remise à zéro.");
      }
    } finally {
      setBusyId(null);
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

  async function subscribe(
    id: string,
    action: "trial" | "months",
    months?: number
  ) {
    setBusyId(id);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/business/${id}/subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "months" ? { action, months } : { action }
        ),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        const gift =
          action === "trial"
            ? "14 jours d'essai"
            : `${months} mois`;
        setMsg(
          `✅ ${gift} ajouté(s).` +
            (d.emailSent
              ? " Le commerçant a été prévenu par e-mail."
              : " (E-mail non envoyé — vérifiez la config Resend.)")
        );
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  /** Demande le nombre de mois gratuits (1 à 24) puis les ajoute. */
  function giftMonths(id: string, name: string) {
    const raw = window.prompt(
      `Offrir des mois gratuits à « ${name} ».\n\nCombien de mois ? (1 à 24)`,
      "1"
    );
    if (raw === null) return;
    const n = Math.round(Number(raw.trim().replace(",", ".")));
    if (!Number.isFinite(n) || n < 1 || n > 24) {
      setMsg("❌ Nombre de mois invalide (1 à 24).");
      return;
    }
    subscribe(id, "months", n);
  }

  async function refund(id: string, name: string) {
    const raw = window.prompt(
      `Rembourser « ${name} ».\n\nMontant en euros (laissez vide pour rembourser intégralement le dernier paiement) :`,
      ""
    );
    if (raw === null) return;
    const trimmed = raw.trim().replace(",", ".");
    const amount = trimmed === "" ? undefined : Number(trimmed);
    if (amount !== undefined && (!isFinite(amount) || amount <= 0)) {
      setMsg("❌ Montant invalide.");
      return;
    }
    if (
      !confirm(
        amount
          ? `Confirmer le remboursement de ${amount} € à « ${name} » ?`
          : `Confirmer le remboursement intégral du dernier paiement de « ${name} » ?`
      )
    )
      return;
    setBusyId(id);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/business/${id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(amount ? { amount } : {}),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg(
          `✅ Remboursement de ${d.amount} effectué.` +
            (d.emailSent
              ? ` E-mail de confirmation envoyé à ${d.ownerEmail}.`
              : " (E-mail non envoyé — vérifiez la config Resend.)")
        );
        router.refresh();
      } else {
        setMsg("❌ " + (d.error || "Échec du remboursement."));
      }
    } catch {
      setMsg("❌ Connexion impossible.");
    } finally {
      setBusyId(null);
    }
  }

  async function changeOwner(id: string, current: string) {
    const email = window.prompt(
      "Nouvelle adresse e-mail du propriétaire de cet établissement :",
      current
    );
    if (email === null) return;
    const clean = email.trim();
    if (!clean) return;
    setBusyId(id);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/business/${id}/owner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: clean }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg(`✅ Propriétaire de ce compte mis à jour : ${clean}`);
        router.refresh();
      } else {
        setMsg("❌ " + (d.error || "Échec du changement de propriétaire."));
      }
    } catch {
      setMsg("❌ Connexion impossible.");
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

      {/* ---- Statistiques plateforme ---- */}
      <div className="stat-h">Établissements</div>
      <div className="stat-grid">
        <div className="stat">
          <div className="stat-icon"><Icon name="chart" size={22} /></div>
          <div><div className="stat-n">{stats.bizTotal}</div><div className="stat-l">Total</div></div>
        </div>
        <div className="stat">
          <div className="stat-icon"><Icon name="check" size={22} /></div>
          <div><div className="stat-n">{stats.bizActive}</div><div className="stat-l">Avec accès</div></div>
        </div>
        <div className="stat">
          <div className="stat-icon"><Icon name="event" size={22} /></div>
          <div><div className="stat-n">{stats.bizTrial}</div><div className="stat-l">En essai</div></div>
        </div>
        <div className="stat">
          <div className="stat-icon"><Icon name="block" size={22} /></div>
          <div><div className="stat-n">{stats.bizSuspended}</div><div className="stat-l">Suspendus</div></div>
        </div>
      </div>

      <div className="stat-h">Activité — tours joués</div>
      <div className="stat-grid">
        <div className="stat">
          <div className="stat-icon"><Icon name="trending" size={22} /></div>
          <div><div className="stat-n">{stats.playsTotal}</div><div className="stat-l">Total</div></div>
        </div>
        <div className="stat">
          <div className="stat-icon"><Icon name="event" size={22} /></div>
          <div><div className="stat-n">{stats.playsMonth}</div><div className="stat-l">Ce mois-ci</div></div>
        </div>
        <div className="stat">
          <div className="stat-icon"><Icon name="event" size={22} /></div>
          <div><div className="stat-n">{stats.playsToday}</div><div className="stat-l">Aujourd'hui</div></div>
        </div>
        <div className="stat">
          <div className="stat-icon"><Icon name="share" size={22} /></div>
          <div><div className="stat-n">{stats.insta}</div><div className="stat-l">via Instagram</div></div>
        </div>
        <div className="stat">
          <div className="stat-icon"><Icon name="star" size={22} /></div>
          <div><div className="stat-n">{stats.review}</div><div className="stat-l">via Avis Google</div></div>
        </div>
      </div>

      <div className="stat-h">Cadeaux &amp; clients</div>
      <div className="stat-grid">
        <div className="stat">
          <div className="stat-icon"><Icon name="redeem" size={22} /></div>
          <div><div className="stat-n">{stats.won}</div><div className="stat-l">Cadeaux gagnés</div></div>
        </div>
        <div className="stat">
          <div className="stat-icon"><Icon name="check" size={22} /></div>
          <div><div className="stat-n">{stats.redeemed}</div><div className="stat-l">Récupérés en caisse · {redemptionRate}%</div></div>
        </div>
        <div className="stat">
          <div className="stat-icon"><Icon name="mail" size={22} /></div>
          <div><div className="stat-n">{stats.leads}</div><div className="stat-l">E-mails capturés</div></div>
        </div>
      </div>

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

      {businesses.some((b) => b.setup_paid_at && !b.setup_done_at) && (
        <div className="dash-card setup-todo">
          <h2>🛠️ Installations à réaliser</h2>
          <ul className="setup-todo-list">
            {businesses
              .filter((b) => b.setup_paid_at && !b.setup_done_at)
              .map((b) => (
                <li key={b.id}>
                  <div className="setup-todo-info">
                    <b>{b.name}</b>
                    <span>
                      {b.setup_option === "onsite"
                        ? "Sur place (129 €)"
                        : "À distance (79 €)"}{" "}
                      · payée le {fmtDate(b.setup_paid_at)}
                    </span>
                    <span>
                      {b.phone ? (
                        <a href={`tel:${b.phone.replace(/\s/g, "")}`}>
                          📞 {b.phone}
                        </a>
                      ) : (
                        "📞 non renseigné"
                      )}{" "}
                      · ✉️ {b.owner_email}
                    </span>
                    {b.setup_option === "onsite" && (
                      <span>📍 {b.address ?? "adresse non renseignée"}</span>
                    )}
                    {b.admin_note && (
                      <span className="admin-note">📝 {b.admin_note}</span>
                    )}
                  </div>
                  <div className="setup-todo-actions">
                    <button
                      className="btn-mini soft"
                      disabled={busyId === b.id}
                      onClick={() => saveNote(b.id, b.admin_note)}
                    >
                      📝 Note
                    </button>
                    <button
                      className="btn-mini ok"
                      disabled={busyId === b.id}
                      onClick={() => markSetupDone(b.id, b.name)}
                    >
                      <Icon name="check" size={15} /> Marquer comme faite
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}

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
                        {b.admin_note && (
                          <div className="admin-note">📝 {b.admin_note}</div>
                        )}
                      </td>
                      <td className="admin-email">
                        {b.owner_email || "(non lié)"}
                        {b.phone && (
                          <>
                            <br />
                            <a
                              className="admin-phone"
                              href={`tel:${b.phone.replace(/\s/g, "")}`}
                            >
                              📞 {b.phone}
                            </a>
                          </>
                        )}
                        <br />
                        <button
                          className="admin-owner-btn"
                          disabled={busy}
                          onClick={() => changeOwner(b.id, b.owner_email)}
                        >
                          Changer le propriétaire
                        </button>
                      </td>
                      <td>{b.plays}</td>
                      <td>
                        <div>
                          {b.subscription_status}
                          {b.plan && (
                            <>
                              <br />
                              <small className="admin-plan">
                                {PLAN_LABEL[b.plan] ?? b.plan}
                              </small>
                            </>
                          )}
                        </div>
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
                            onClick={() => giftMonths(b.id, b.name)}
                          >
                            <Icon name="add" size={15} /> Offrir des mois…
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
                            className="btn-mini soft"
                            disabled={busy}
                            onClick={() => refund(b.id, b.name)}
                          >
                            <Icon name="redeem" size={15} /> Rembourser
                          </button>
                          <button
                            className="btn-mini soft"
                            disabled={busy}
                            onClick={() => saveNote(b.id, b.admin_note)}
                          >
                            📝 Note
                          </button>
                          <button
                            className="btn-mini soft"
                            disabled={busy}
                            onClick={() => resetCounters(b.id, b.name)}
                          >
                            🔄 RAZ compteurs
                          </button>
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
