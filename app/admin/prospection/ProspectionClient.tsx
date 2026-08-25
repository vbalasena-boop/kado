"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PROSPECT_SEGMENTS,
  type ProspectSegment,
  type ProspectStatus,
} from "@/lib/prospection/types";

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

export default function ProspectionClient({
  prospects,
  migrationMissing,
}: {
  prospects: ProspectRow[];
  migrationMissing: boolean;
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
          `${data.enriched} fiche(s) enrichie(s) sur ${data.scanned} analysée(s) (email / Instagram).`
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

  return (
    <div className="dash-card">
      <h2>🔎 Prospection</h2>
      <p style={{ color: "#666", marginTop: -4 }}>
        Trouve des commerces à démarcher, classés par potentiel (peu d'avis
        Google = fort potentiel Kado).
      </p>

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
      </div>

      {/* --- Liste --- */}
      {filtered.length === 0 ? (
        <p style={{ color: "#666" }}>
          Aucun prospect. Lance un sourcing ci-dessus pour commencer.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
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
                <th style={th}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={td}>
                    <b>{p.score ?? "—"}</b>
                  </td>
                  <td style={td}>
                    {p.name}
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
                    {p.email && <span title={p.email}>✉️</span>}{" "}
                    {p.instagram_handle && (
                      <a
                        href={`https://instagram.com/${p.instagram_handle}`}
                        target="_blank"
                        rel="noreferrer"
                        title={`@${p.instagram_handle}`}
                      >
                        📸
                      </a>
                    )}
                    {!p.email && !p.instagram_handle && "—"}
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
        </div>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid #ccc",
  fontSize: 14,
};
const th: React.CSSProperties = { padding: "8px 10px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "8px 10px" };
