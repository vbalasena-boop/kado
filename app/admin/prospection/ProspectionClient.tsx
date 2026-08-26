"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PROSPECT_SEGMENTS,
  type ProspectSegment,
  type ProspectStatus,
} from "@/lib/prospection/types";

export type EmailState = "sent" | "approved" | "draft" | null;

export type ProspectRow = {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  google_rating: number | null;
  google_reviews_count: number | null;
  website: string | null;
  instagram_handle: string | null;
  email: string | null;
  score: number | null;
  status: ProspectStatus;
  created_at: string;
  /** État d'envoi de l'email (le plus avancé des messages email du prospect). */
  emailState?: EmailState;
};

const SEGMENT_LABEL: Record<ProspectSegment, string> = {
  resto: "Resto / Bar / Café",
  beaute: "Beauté / Coiffure",
  boutique: "Boutique",
  sport: "Sport / Bien-être",
  autre: "Autre",
};

const STATUS_LABEL: Record<ProspectStatus, string> = {
  new: "Nouveau",
  queued: "En file",
  emailed: "Email envoyé",
  dm_pending: "DM à envoyer",
  dm_sent: "DM envoyé",
  replied: "A répondu",
  interested: "Intéressé",
  client: "Client",
  excluded: "Exclu",
};

type SortKey = "score" | "reviews" | "rating" | "name";

export type Stats = {
  total: number;
  byStatus: Record<string, number>;
  withEmail: number;
  withInstagram: number;
  emailsToday: number;
  dmToday: number;
  emailCap: number;
  pendingEmails: number;
  /** Emails de prospection réellement envoyés (initiaux + relances), tout temps. */
  sentTotal: number;
  /** Bounces durs détectés (adresses invalides), tout temps. */
  bouncedTotal: number;
  /** Performance par variante d'objet : envoyés vs réponses. */
  subjectPerf: { label: string; sent: number; replied: number }[];
};

export default function ProspectionClient({
  prospects,
  migrationMissing,
  stats,
}: {
  prospects: ProspectRow[];
  migrationMissing: boolean;
  stats: Stats | null;
}) {
  const router = useRouter();

  // --- Formulaire de sourcing ---
  const [city, setCity] = useState("");
  const [segments, setSegments] = useState<ProspectSegment[]>(["resto"]);
  const [limit, setLimit] = useState(30);
  const [sourcing, setSourcing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);

  // --- Filtres/tri (côté client) ---
  const [fSegment, setFSegment] = useState<string>("");
  const [fStatus, setFStatus] = useState<string>("");
  const [maxReviews, setMaxReviews] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("score");

  // --- Pagination (côté client) ---
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(0);
  // Revenir à la 1ʳᵉ page quand un filtre/tri change.
  useEffect(() => setPage(0), [fSegment, fStatus, maxReviews, sort]);

  function toggleSegment(s: ProspectSegment) {
    setSegments((cur) =>
      cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]
    );
  }

  async function runSourcing() {
    if (!city.trim() || segments.length === 0) {
      setMessage("Renseigne une ville et au moins un segment.");
      return;
    }
    setSourcing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/prospection/source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: city.trim(), segments, limit }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`Erreur : ${data.error ?? "inconnue"}`);
      } else {
        setMessage(
          `${data.inserted} nouveau(x) prospect(s) ajouté(s)` +
            (data.duplicates ? `, ${data.duplicates} doublon(s) ignoré(s)` : "") +
            (data.mock ? " — mode démo (pas de clé Google Places)" : "")
        );
        router.refresh();
      }
    } catch {
      setMessage("Erreur réseau pendant le sourcing.");
    } finally {
      setSourcing(false);
    }
  }

  async function changeStatus(id: string, status: ProspectStatus) {
    try {
      const res = await fetch(`/api/admin/prospection/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) router.refresh();
      else setMessage("Impossible de changer le statut.");
    } catch {
      setMessage("Erreur réseau (changement de statut).");
    }
  }

  async function sendNow() {
    if (!window.confirm("Envoyer maintenant les emails approuvés ?")) return;
    setMessage(null);
    try {
      const res = await fetch("/api/admin/prospection/send-now", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMessage(
          `${data.sent} email(s) envoyé(s)` +
            (data.followups ? ` (dont ${data.followups} relance(s))` : "") +
            `, ${data.skipped} ignoré(s), ${data.failed} échec(s)` +
            (data.invalid ? `, ${data.invalid} adresse(s) invalide(s) écartée(s)` : "") +
            (data.simulated ? " — MODE SIMULATION (aucun SMTP configuré, rien n'est réellement parti)" : "") +
            `. Plafond du jour : ${data.dailyCap ?? data.cap}.`
        );
        router.refresh();
      } else setMessage(`Erreur : ${data.error ?? "inconnue"}`);
    } catch {
      setMessage("Erreur réseau (envoi).");
    }
  }

  // Ajout manuel d'un prospect
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCity, setAddCity] = useState("");
  const [addSegment, setAddSegment] = useState<ProspectSegment>("resto");
  const [addEmail, setAddEmail] = useState("");
  const [addInsta, setAddInsta] = useState("");
  const [addReviews, setAddReviews] = useState("");

  async function addProspect() {
    if (!addName.trim()) {
      setMessage("Renseigne au moins le nom du commerce.");
      return;
    }
    try {
      const res = await fetch("/api/admin/prospection/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addName.trim(),
          city: addCity.trim() || undefined,
          category: addSegment,
          email: addEmail.trim() || undefined,
          instagram_handle: addInsta.trim() || undefined,
          google_reviews_count: addReviews === "" ? undefined : Number(addReviews),
        }),
      });
      if (res.ok) {
        setMessage("Prospect ajouté ✅");
        setAddName("");
        setAddCity("");
        setAddEmail("");
        setAddInsta("");
        setAddReviews("");
        setShowAdd(false);
        router.refresh();
      } else setMessage("Erreur à l'ajout du prospect.");
    } catch {
      setMessage("Erreur réseau (ajout).");
    }
  }

  async function approveAll() {
    if (!window.confirm("Générer + approuver l'email de tous les prospects avec un contact ?")) return;
    setMessage(null);
    try {
      const res = await fetch("/api/admin/prospection/approve-all", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMessage(`${data.approved} email(s) approuvé(s) et ajoutés à la file d'envoi.`);
        router.refresh();
      } else setMessage(`Erreur : ${data.error ?? "inconnue"}`);
    } catch {
      setMessage("Erreur réseau (approbation).");
    }
  }

  async function regenerateAll() {
    if (!window.confirm("Régénérer les messages (brouillons) de tous les prospects ?")) return;
    setMessage(null);
    try {
      const res = await fetch("/api/admin/prospection/regenerate-all", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMessage(`${data.regenerated} prospect(s) régénéré(s).`);
        router.refresh();
      } else setMessage(`Erreur : ${data.error ?? "inconnue"}`);
    } catch {
      setMessage("Erreur réseau (régénération).");
    }
  }

  async function checkReplies() {
    setMessage(null);
    try {
      const res = await fetch("/api/admin/prospection/check-replies", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMessage(
          data.configured
            ? `${data.matched} réponse(s) détectée(s)` +
                (data.booked ? `, ${data.booked} RDV Calendly (→ Intéressé)` : "") +
                (data.bounced ? `, ${data.bounced} bounce(s) supprimé(s)` : "") +
                ` (${data.scanned} expéditeurs analysés).`
            : "IMAP non configuré : ajoute les variables PROSPECT_IMAP_* / SMTP dans Vercel."
        );
        router.refresh();
      } else setMessage(`Erreur : ${data.error ?? "inconnue"}`);
    } catch {
      setMessage("Erreur réseau (vérification des réponses).");
    }
  }

  async function revalidate() {
    setMessage(null);
    try {
      const res = await fetch("/api/admin/prospection/revalidate", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMessage(
          `Contacts revérifiés : ${data.cleaned_emails ?? 0} email(s) et ${data.cleaned_handles ?? 0} Instagram invalides effacés.`
        );
        router.refresh();
      } else setMessage(`Erreur : ${data.error ?? "inconnue"}`);
    } catch {
      setMessage("Erreur réseau (revérification).");
    }
  }

  async function clearProspects(mode: "demo" | "all") {
    const label =
      mode === "all"
        ? "Supprimer TOUS les prospects ? Cette action est irréversible."
        : "Supprimer les prospects de démonstration ?";
    if (!window.confirm(label)) return;
    try {
      const res = await fetch("/api/admin/prospection/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`${data.deleted} prospect(s) supprimé(s).`);
        router.refresh();
      } else {
        setMessage(`Erreur : ${data.error ?? "inconnue"}`);
      }
    } catch {
      setMessage("Erreur réseau (suppression).");
    }
  }

  async function clearSuppression() {
    if (!window.confirm("Vider la liste de suppression ? Les adresses écartées (bounces/désinscriptions) redeviendront contactables.")) return;
    setMessage(null);
    try {
      const res = await fetch("/api/admin/prospection/clear-suppression", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMessage(`${data.deleted} adresse(s) retirée(s) de la liste de suppression.`);
        router.refresh();
      } else setMessage(`Erreur : ${data.error ?? "inconnue"}`);
    } catch {
      setMessage("Erreur réseau (liste de suppression).");
    }
  }

  async function runEnrich() {
    setEnriching(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/prospection/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`Erreur : ${data.error ?? "inconnue"}`);
      } else {
        setMessage(
          `${data.enriched} fiche(s) enrichie(s) sur ${data.scanned} analysée(s) — ` +
            `${data.emails_found ?? 0} email(s), ${data.instagram_found ?? 0} Instagram trouvé(s).`
        );
        router.refresh();
      }
    } catch {
      setMessage("Erreur réseau pendant l'enrichissement.");
    } finally {
      setEnriching(false);
    }
  }

  const filtered = useMemo(() => {
    const max = maxReviews === "" ? null : Number(maxReviews);
    const rows = prospects.filter((p) => {
      if (fSegment && p.category !== fSegment) return false;
      if (fStatus && p.status !== fStatus) return false;
      if (max != null && (p.google_reviews_count ?? Infinity) > max) return false;
      return true;
    });
    rows.sort((a, b) => {
      switch (sort) {
        case "reviews":
          return (a.google_reviews_count ?? 0) - (b.google_reviews_count ?? 0);
        case "rating":
          return (b.google_rating ?? 0) - (a.google_rating ?? 0);
        case "name":
          return a.name.localeCompare(b.name);
        default:
          return (b.score ?? 0) - (a.score ?? 0);
      }
    });
    return rows;
  }, [prospects, fSegment, fStatus, maxReviews, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="dash-card">
      <h2>🔎 Prospection</h2>
      <p style={{ color: "#666", marginTop: -4 }}>
        Trouve des commerces à démarcher, classés par potentiel (peu d'avis
        Google = fort potentiel Kado). <a href="/admin/prospection/instagram">📸 File Instagram →</a>
      </p>

      {stats && <StatsBand stats={stats} />}
      {stats && <SubjectPerf perf={stats.subjectPerf} />}

      {migrationMissing && (
        <div
          style={{
            background: "#fff4e5",
            border: "1px solid #ffd8a8",
            borderRadius: 8,
            padding: "10px 12px",
            margin: "10px 0",
            fontSize: 14,
          }}
        >
          ⚠️ Les tables de prospection ne semblent pas encore créées. Exécute la
          migration <code>supabase/migrations/0043_prospection.sql</code> dans
          Supabase (SQL Editor).
        </div>
      )}

      {/* --- Sourcing --- */}
      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 10,
          padding: 14,
          margin: "14px 0",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Lancer un sourcing</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Ville (ex. Lyon)"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc" }}
          />
          <label style={{ fontSize: 14 }}>
            Limite&nbsp;
            <input
              type="number"
              min={1}
              max={120}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              style={{ width: 64, padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc" }}
            />
          </label>
          <button
            onClick={runSourcing}
            disabled={sourcing}
            className="dash-signout"
            style={{ opacity: sourcing ? 0.6 : 1 }}
          >
            {sourcing ? "Sourcing…" : "Lancer le sourcing"}
          </button>
          <button
            onClick={runEnrich}
            disabled={enriching}
            className="dash-signout"
            style={{ opacity: enriching ? 0.6 : 1 }}
            title="Devine les emails et comptes Instagram depuis les sites web"
          >
            {enriching ? "Enrichissement…" : "Enrichir (email / Insta)"}
          </button>
          <button
            onClick={revalidate}
            className="dash-signout"
            title="Efface les emails/Instagram invalides déjà enregistrés (plateformes, exemples)"
          >
            Revérifier les contacts
          </button>
          <button
            onClick={approveAll}
            className="dash-signout"
            style={{ color: "#2e7d32" }}
            title="Génère + approuve l'email de tous les prospects avec un contact (remplit la file)"
          >
            ✅ Approuver tous les emails
          </button>
          <button
            onClick={sendNow}
            className="dash-signout"
            title="Envoie maintenant les emails approuvés (sinon envoi automatique quotidien)"
          >
            ✉️ Envoyer les emails approuvés
          </button>
          <button
            onClick={checkReplies}
            className="dash-signout"
            title="Lit ta boîte email et marque 'A répondu' les prospects qui ont répondu"
          >
            📥 Vérifier les réponses
          </button>
          <button
            onClick={regenerateAll}
            className="dash-signout"
            title="Régénère les messages (brouillons) de tous les prospects avec la dernière version"
          >
            🔄 Régénérer tous les messages
          </button>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
          {PROSPECT_SEGMENTS.map((s) => (
            <label key={s} style={{ fontSize: 14, display: "flex", gap: 4, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={segments.includes(s)}
                onChange={() => toggleSegment(s)}
              />
              {SEGMENT_LABEL[s]}
            </label>
          ))}
        </div>
        {message && (
          <p style={{ marginTop: 10, fontSize: 14, color: "#333" }}>{message}</p>
        )}
      </div>

      {/* --- Ajout manuel --- */}
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="dash-signout"
          style={{ fontSize: 13 }}
        >
          {showAdd ? "Annuler" : "➕ Ajouter un prospect à la main"}
        </button>
        {showAdd && (
          <div
            style={{
              border: "1px solid #eee",
              borderRadius: 10,
              padding: 14,
              marginTop: 8,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Nom du commerce *" style={addInput} />
            <input value={addCity} onChange={(e) => setAddCity(e.target.value)} placeholder="Ville" style={addInput} />
            <select value={addSegment} onChange={(e) => setAddSegment(e.target.value as ProspectSegment)} style={selectStyle}>
              {PROSPECT_SEGMENTS.map((s) => (
                <option key={s} value={s}>{SEGMENT_LABEL[s]}</option>
              ))}
            </select>
            <input value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="email@commerce.fr" style={addInput} />
            <input value={addInsta} onChange={(e) => setAddInsta(e.target.value)} placeholder="@instagram" style={{ ...addInput, minWidth: 140 }} />
            <input value={addReviews} onChange={(e) => setAddReviews(e.target.value)} placeholder="Nb avis Google" type="number" min={0} style={{ ...addInput, minWidth: 130 }} />
            <button onClick={addProspect} className="dash-signout" style={{ fontSize: 13 }}>
              Ajouter
            </button>
          </div>
        )}
      </div>

      {/* --- Filtres --- */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <select value={fSegment} onChange={(e) => setFSegment(e.target.value)} style={selectStyle}>
          <option value="">Tous les segments</option>
          {PROSPECT_SEGMENTS.map((s) => (
            <option key={s} value={s}>{SEGMENT_LABEL[s]}</option>
          ))}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={selectStyle}>
          <option value="">Tous les statuts</option>
          {(Object.keys(STATUS_LABEL) as ProspectStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <label style={{ fontSize: 14 }}>
          Avis max&nbsp;
          <input
            type="number"
            min={0}
            placeholder="∞"
            value={maxReviews}
            onChange={(e) => setMaxReviews(e.target.value)}
            style={{ width: 70, padding: "6px 8px", borderRadius: 8, border: "1px solid #ccc" }}
          />
        </label>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} style={selectStyle}>
          <option value="score">Tri : score</option>
          <option value="reviews">Tri : moins d'avis</option>
          <option value="rating">Tri : meilleure note</option>
          <option value="name">Tri : nom</option>
        </select>
        <span style={{ marginLeft: "auto", color: "#666", fontSize: 14 }}>
          {filtered.length} prospect(s)
        </span>
        <button
          onClick={() => {
            window.location.href = "/api/admin/prospection/export";
          }}
          className="dash-signout"
          style={{ fontSize: 13 }}
          title="Télécharger tous les prospects au format CSV (Excel)"
        >
          ⬇️ Exporter (CSV)
        </button>
        <button
          onClick={() => clearProspects("demo")}
          className="dash-signout"
          style={{ fontSize: 13 }}
          title="Supprime uniquement les prospects de démonstration"
        >
          Vider la démo
        </button>
        <button
          onClick={() => clearProspects("all")}
          className="dash-signout"
          style={{ fontSize: 13, color: "#c0392b" }}
          title="Supprime TOUS les prospects"
        >
          Tout vider
        </button>
        <button
          onClick={clearSuppression}
          className="dash-signout"
          style={{ fontSize: 13 }}
          title="Vide la liste des adresses écartées (bounces/désinscriptions). À utiliser avec précaution."
        >
          Vider la liste de suppression
        </button>
      </div>

      {/* --- Liste --- */}
      {filtered.length === 0 ? (
        <p style={{ color: "#666" }}>
          Aucun prospect. Lance un sourcing ci-dessus pour commencer.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", margin: "2px 0 10px", fontSize: 12, color: "#666" }}>
            <span>Colonnes Email / DM :</span>
            <Pill {...PILL.sent} />
            <Pill {...PILL.approved} />
            <Pill {...PILL.draft} />
            <Pill {...PILL.none} />
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "2px solid #eee" }}>
                <th style={th}>Score</th>
                <th style={th}>Nom</th>
                <th style={th}>Ville</th>
                <th style={th}>Segment</th>
                <th style={th}>Note</th>
                <th style={th}>Avis</th>
                <th style={th}>Contact</th>
                <th style={th}>Email</th>
                <th style={th}>DM</th>
                <th style={th}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={td}>
                    <b>{p.score ?? "—"}</b>
                  </td>
                  <td style={td}>
                    <a href={`/admin/prospection/${p.id}`}>{p.name}</a>
                    {p.website && (
                      <>
                        {" "}
                        <a href={p.website} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                          site ↗
                        </a>
                      </>
                    )}
                  </td>
                  <td style={td}>{p.city ?? "—"}</td>
                  <td style={td}>
                    {p.category ? SEGMENT_LABEL[p.category as ProspectSegment] ?? p.category : "—"}
                  </td>
                  <td style={td}>{p.google_rating ?? "—"}</td>
                  <td style={td}>{p.google_reviews_count ?? "—"}</td>
                  <td style={td}>
                    {p.email && (
                      <a href={`mailto:${p.email}`} title="Écrire un email" style={{ fontSize: 13 }}>
                        ✉️ {p.email}
                      </a>
                    )}
                    {p.email && p.instagram_handle && <br />}
                    {p.instagram_handle && (
                      <a
                        href={`https://instagram.com/${p.instagram_handle}`}
                        target="_blank"
                        rel="noreferrer"
                        title={`@${p.instagram_handle}`}
                        style={{ fontSize: 13 }}
                      >
                        📸 @{p.instagram_handle}
                      </a>
                    )}
                    {!p.email && !p.instagram_handle && "—"}
                  </td>
                  <td style={td}>
                    <EmailBadge p={p} />
                  </td>
                  <td style={td}>
                    <DmBadge p={p} />
                  </td>
                  <td style={td}>
                    <select
                      value={p.status}
                      onChange={(e) =>
                        changeStatus(p.id, e.target.value as ProspectStatus)
                      }
                      style={{
                        padding: "4px 6px",
                        borderRadius: 6,
                        border: "1px solid #ccc",
                        fontSize: 13,
                      }}
                    >
                      {(Object.keys(STATUS_LABEL) as ProspectStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center", marginTop: 12 }}>
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={clampedPage <= 0}
                className="dash-signout"
                style={{ fontSize: 13, opacity: clampedPage <= 0 ? 0.5 : 1 }}
              >
                ← Précédent
              </button>
              <span style={{ fontSize: 13, color: "#666" }}>
                Page {clampedPage + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={clampedPage >= totalPages - 1}
                className="dash-signout"
                style={{ fontSize: 13, opacity: clampedPage >= totalPages - 1 ? 0.5 : 1 }}
              >
                Suivant →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Badges d'état d'envoi (Email / DM) ---
type PillProps = { text: string; bg: string; color: string; title?: string };

const PILL: Record<"sent" | "approved" | "draft" | "none", PillProps> = {
  sent: { text: "✅ Envoyé", bg: "#e6f4ea", color: "#1e7d34" },
  approved: { text: "⏳ À envoyer", bg: "#fff4e0", color: "#a86b00" },
  draft: { text: "✍️ Brouillon", bg: "#eef0f3", color: "#555" },
  none: { text: "—", bg: "#f5f5f7", color: "#999" },
};

function Pill({ text, bg, color, title }: PillProps) {
  return (
    <span
      title={title}
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        background: bg,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

/** État d'envoi de l'email du prospect. */
function EmailBadge({ p }: { p: ProspectRow }) {
  if (p.emailState === "sent" || p.status === "emailed") return <Pill {...PILL.sent} />;
  if (p.emailState === "approved") return <Pill {...PILL.approved} />;
  if (p.emailState === "draft") return <Pill {...PILL.draft} />;
  return <Pill {...PILL.none} title={p.email ? "Message pas encore généré" : "Pas d'email"} />;
}

/** État d'envoi du DM Instagram (suivi via le statut du prospect). */
function DmBadge({ p }: { p: ProspectRow }) {
  if (p.status === "dm_sent") return <Pill {...PILL.sent} />;
  if (p.status === "dm_pending") return <Pill text="⏳ En file" bg="#fff4e0" color="#a86b00" />;
  if (p.instagram_handle) return <Pill text="À envoyer" bg="#eef0f3" color="#555" title="Dans la file Instagram" />;
  return <Pill {...PILL.none} title="Pas de compte Instagram" />;
}

/** Tableau « Performance par objet » : taux de réponse par variante d'objet. */
function SubjectPerf({ perf }: { perf: Stats["subjectPerf"] }) {
  const totalSent = perf.reduce((s, p) => s + p.sent, 0);
  if (totalSent === 0) return null; // rien envoyé encore → pas de mesure

  // Meilleure variante parmi celles ayant un minimum d'envois (fiabilité).
  const eligible = perf.filter((p) => p.sent >= 5);
  const best =
    eligible.length > 0
      ? eligible.reduce((a, b) => (b.replied / b.sent > a.replied / a.sent ? b : a))
      : null;

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 14, margin: "0 0 16px" }}>
      <h3 style={{ margin: "0 0 2px" }}>📊 Performance par objet d'email</h3>
      <p style={{ color: "#666", marginTop: 0, fontSize: 13 }}>
        Taux de réponse selon l'objet utilisé — pour garder les formulations qui
        marchent le mieux.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #eee" }}>
              <th style={th}>Objet</th>
              <th style={th}>Envoyés</th>
              <th style={th}>Réponses</th>
              <th style={th}>Taux</th>
            </tr>
          </thead>
          <tbody>
            {perf.map((p) => {
              const rate = p.sent > 0 ? Math.round((p.replied / p.sent) * 100) : 0;
              const isBest = Boolean(best && p.label === best.label && p.sent >= 5);
              return (
                <tr
                  key={p.label}
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    background: isBest ? "#e6f4ea" : undefined,
                  }}
                >
                  <td style={td}>
                    {p.label.replace("{name}", "…")} {isBest && "🏆"}
                  </td>
                  <td style={td}>{p.sent}</td>
                  <td style={td}>{p.replied}</td>
                  <td style={td}>{p.sent > 0 ? `${rate}%` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ color: "#999", fontSize: 12, marginBottom: 0 }}>
        Un taux n'est fiable qu'à partir de ~15–20 envois par objet. 🏆 = meilleure
        variante à ce stade.
      </p>
    </div>
  );
}

function StatsBand({ stats }: { stats: Stats }) {
  const s = stats.byStatus;
  const contacted =
    (s.emailed ?? 0) + (s.dm_sent ?? 0) + (s.replied ?? 0) + (s.interested ?? 0) + (s.client ?? 0);
  const replied = (s.replied ?? 0) + (s.interested ?? 0) + (s.client ?? 0);
  const rate = contacted > 0 ? Math.round((replied / contacted) * 100) : 0;

  // Délivrabilité : taux de bounce (adresses invalides / emails envoyés).
  // Seuils usuels : < 2 % sain · 2–5 % à surveiller · > 5 % danger réputation.
  const bounceRate =
    stats.sentTotal > 0 ? Math.round((stats.bouncedTotal / stats.sentTotal) * 100) : 0;
  const bounceColor = bounceRate > 5 ? "#c0392b" : bounceRate > 2 ? "#a86b00" : "#2e7d32";
  // Alerte seulement avec assez de volume pour être significatif.
  const bounceWarn = stats.sentTotal >= 20 && bounceRate > 5;

  const tiles: { label: string; value: string; color?: string }[] = [
    { label: "Prospects", value: String(stats.total) },
    { label: "À contacter", value: String((s.new ?? 0) + (s.queued ?? 0)) },
    { label: "Contactés", value: String(contacted) },
    { label: "Ont répondu", value: String(s.replied ?? 0), color: "#2e7d32" },
    { label: "Intéressés", value: String(s.interested ?? 0), color: "#2e7d32" },
    { label: "Clients", value: String(s.client ?? 0), color: "#2e7d32" },
    { label: "Taux de réponse", value: `${rate}%` },
    { label: "Avec email", value: String(stats.withEmail) },
    { label: "Avec Insta", value: String(stats.withInstagram) },
    { label: "Emails aujourd'hui", value: `${stats.emailsToday}/${stats.emailCap}` },
    { label: "À envoyer (approuvés)", value: String(stats.pendingEmails), color: "#8b6cff" },
    { label: "DM aujourd'hui", value: String(stats.dmToday) },
    { label: "Taux de bounce", value: `${bounceRate}%`, color: bounceColor },
  ];

  return (
    <>
      {bounceWarn && (
        <div
          style={{
            background: "#fdecea",
            border: "1px solid #f5c6cb",
            borderRadius: 8,
            padding: "10px 12px",
            margin: "10px 0",
            fontSize: 14,
            color: "#a12b21",
          }}
        >
          ⚠️ <b>Taux de bounce élevé ({bounceRate}%)</b> — au-delà de 5 %, ta
          réputation d'expéditeur est en danger. Mets en pause les envois,
          revérifie les contacts (bouton « Revérifier les contacts ») et vérifie
          la configuration du domaine avant de continuer.
        </div>
      )}
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          margin: "10px 0 16px",
        }}
      >
        {tiles.map((t) => (
        <div
          key={t.label}
          style={{
            flex: "1 1 110px",
            minWidth: 100,
            border: "1px solid #eee",
            borderRadius: 10,
            padding: "10px 12px",
            background: "#faf9fc",
          }}
        >
          <div style={{ fontSize: 12, color: "#888" }}>{t.label}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: t.color ?? "#222" }}>
            {t.value}
          </div>
          </div>
        ))}
      </div>
    </>
  );
}

const addInput: React.CSSProperties = {
  padding: 8,
  borderRadius: 8,
  border: "1px solid #ccc",
  minWidth: 180,
};

const selectStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid #ccc",
  fontSize: 14,
};
const th: React.CSSProperties = { padding: "8px 10px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "8px 10px" };
