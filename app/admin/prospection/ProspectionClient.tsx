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

export type Stats = {
  total: number;
  byStatus: Record<string, number>;
  withEmail: number;
  withInstagram: number;
  emailsToday: number;
  dmToday: number;
  emailCap: number;
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
            (data.simulated ? " — MODE SIMULATION (aucun SMTP configuré, rien n'est réellement parti)" : "") +
            `. Plafond du jour : ${data.cap}.`
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

  async function checkReplies() {
    setMessage(null);
    try {
      const res = await fetch("/api/admin/prospection/check-replies", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMessage(
          data.configured
            ? `${data.matched} réponse(s) détectée(s) (${data.scanned} expéditeurs analysés).`
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

  return (
    <div className="dash-card">
      <h2>🔎 Prospection</h2>
      <p style={{ color: "#666", marginTop: -4 }}>
        Trouve des commerces à démarcher, classés par potentiel (peu d'avis
        Google = fort potentiel Kado). <a href="/admin/prospection/instagram">📸 File Instagram →</a>
      </p>

      {stats && <StatsBand stats={stats} />}

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

function StatsBand({ stats }: { stats: Stats }) {
  const s = stats.byStatus;
  const contacted =
    (s.emailed ?? 0) + (s.dm_sent ?? 0) + (s.replied ?? 0) + (s.interested ?? 0) + (s.client ?? 0);
  const replied = (s.replied ?? 0) + (s.interested ?? 0) + (s.client ?? 0);
  const rate = contacted > 0 ? Math.round((replied / contacted) * 100) : 0;

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
    { label: "DM aujourd'hui", value: String(stats.dmToday) },
  ];

  return (
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
