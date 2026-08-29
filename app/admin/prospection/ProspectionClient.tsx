"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PROSPECT_SEGMENTS,
  type ProspectSegment,
  type ProspectStatus,
} from "@/lib/prospection/types";
import { mapCsv } from "@/lib/prospection/csv";
import CityInput from "./CityInput";
import type {
  DeliverabilityReport,
  DeliverabilityCheck,
} from "@/lib/prospection/deliverability";

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

/** Options du filtre « contact » (présence email / Instagram). */
const CONTACT_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Tous les contacts" },
  { value: "email", label: "Avec email" },
  { value: "no_email", label: "Sans email" },
  { value: "insta", label: "Avec Instagram" },
  { value: "no_insta", label: "Sans Instagram" },
  { value: "any", label: "Avec email OU Insta" },
  { value: "both", label: "Avec email ET Insta" },
  { value: "none", label: "Sans aucun contact" },
];

/** Vrai si le prospect correspond au filtre de contact choisi. */
function matchContact(
  p: { email: string | null; instagram_handle: string | null },
  f: string
): boolean {
  const hasEmail = Boolean(p.email);
  const hasInsta = Boolean(p.instagram_handle);
  switch (f) {
    case "email":
      return hasEmail;
    case "no_email":
      return !hasEmail;
    case "insta":
      return hasInsta;
    case "no_insta":
      return !hasInsta;
    case "any":
      return hasEmail || hasInsta;
    case "both":
      return hasEmail && hasInsta;
    case "none":
      return !hasEmail && !hasInsta;
    default:
      return true;
  }
}

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

// Colonnes du pipeline (kanban) : regroupent les statuts dans un ordre de
// progression commercial. Une carte apparaît dans la 1ʳᵉ colonne qui contient
// son statut.
const PIPELINE_COLUMNS: {
  key: string;
  label: string;
  emoji: string;
  statuses: ProspectStatus[];
  accent: string;
}[] = [
  { key: "new", label: "Nouveaux", emoji: "🆕", statuses: ["new"], accent: "#8b6cff" },
  { key: "queued", label: "En file", emoji: "⏳", statuses: ["queued"], accent: "#a86b00" },
  { key: "contacted", label: "Contactés", emoji: "📤", statuses: ["emailed", "dm_pending", "dm_sent"], accent: "#0b7285" },
  { key: "replied", label: "Ont répondu", emoji: "💬", statuses: ["replied"], accent: "#1e7d34" },
  { key: "interested", label: "Intéressés", emoji: "⭐", statuses: ["interested"], accent: "#1e7d34" },
  { key: "client", label: "Clients", emoji: "🏆", statuses: ["client"], accent: "#1e7d34" },
  { key: "excluded", label: "Exclus", emoji: "🚫", statuses: ["excluded"], accent: "#999" },
];

type SortKey = "score" | "reviews" | "rating" | "name";

/** Vrai sur petit écran (mobile) — pour basculer tableau ↔ cartes. */
function useIsMobile(breakpoint = 720): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);
  return isMobile;
}

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
  /** Performance par angle A/B (email IA) : envoyés vs réponses. */
  anglePerf: { label: string; sent: number; replied: number }[];
  /** Conversion par ville : contactés / réponses / clients. */
  byCity: ConversionRow[];
  /** Conversion par secteur : contactés / réponses / clients. */
  bySegment: ConversionRow[];
};

export type ConversionRow = {
  key: string;
  total: number;
  contacted: number;
  replied: number;
  clients: number;
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
  const [fContact, setFContact] = useState<string>("");
  const [maxReviews, setMaxReviews] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("score");

  // --- Affichage : liste détaillée ou pipeline (kanban par statut) ---
  const [view, setView] = useState<"list" | "pipeline">("list");

  // --- Pagination (côté client) ---
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(0);
  // Revenir à la 1ʳᵉ page quand un filtre/tri change.
  useEffect(() => setPage(0), [fSegment, fStatus, fContact, maxReviews, sort]);

  const isMobile = useIsMobile();

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
        const errs = Array.isArray(data.errors) ? data.errors : [];
        const nbVilles = Array.isArray(data.cities) ? data.cities.length : 1;
        if (errs.length > 0) {
          // Google a renvoyé une erreur (quota, clé, réseau…) : on le dit.
          const codes = [...new Set(errs.map((e: { error: string }) => e.error))].join(", ");
          const isQuota = codes.includes("429");
          setMessage(
            `⚠️ Google Places a renvoyé une erreur (${codes})` +
              (isQuota
                ? " — quota atteint. Réessaie dans quelques minutes ou demain."
                : ". Réessaie dans un instant.") +
              (data.inserted ? ` ${data.inserted} prospect(s) tout de même ajouté(s).` : "")
          );
        } else if (data.found === 0) {
          setMessage(
            "0 résultat renvoyé par Google pour cette recherche. Essaie une autre ville ou un autre secteur."
          );
        } else if (data.inserted === 0) {
          setMessage(
            `0 nouveau — ${data.duplicates || data.found} commerce(s) déjà dans ta liste. ` +
              "Rien n'est supprimé. Change de ville ou de secteur pour en ajouter d'autres."
          );
        } else {
          setMessage(
            `✅ ${data.inserted} nouveau(x) prospect(s) ajouté(s)` +
              (nbVilles > 1 ? ` sur ${nbVilles} villes` : "") +
              (data.duplicates ? ` · ${data.duplicates} déjà en liste (ignoré(s))` : "") +
              (data.mock ? " — mode démo (pas de clé Google Places)" : "")
          );
        }
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

  async function runEnrich(rescan = false) {
    if (rescan && !confirm(
      "Re-scanner TOUTE la liste (y compris les fiches déjà tentées) ?\n\n" +
        "Utile après avoir activé Serper. Aucune donnée n'est supprimée — on ne " +
        "remplit que ce qui manque. Si Serper est configuré, ça consomme des crédits Serper."
    )) return;
    setEnriching(true);
    setMessage(null);
    // Enchaîne automatiquement les lots (15/appel) jusqu'à avoir tout tenté,
    // pour couvrir TOUTE la liste en un seul clic (chaque appel reste court).
    let totalScanned = 0;
    let totalEmails = 0;
    let totalInsta = 0;
    const MAX_ROUNDS = 40; // garde-fou (≈600 fiches) contre toute boucle infinie
    try {
      for (let round = 0; round < MAX_ROUNDS; round++) {
        const res = await fetch("/api/admin/prospection/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Le re-scan (oubli des « déjà tentées ») ne doit se faire qu'au 1ᵉʳ tour.
          body: JSON.stringify(rescan && round === 0 ? { rescan: true } : {}),
        });
        const data = await res.json();
        if (!res.ok) {
          setMessage(`Erreur : ${data.error ?? "inconnue"}`);
          break;
        }
        totalScanned += data.scanned ?? 0;
        totalEmails += data.emails_found ?? 0;
        totalInsta += data.instagram_found ?? 0;
        const remaining = data.remaining ?? 0;
        // Progression en direct pendant l'enchaînement.
        setMessage(
          `Enrichissement en cours… ${totalScanned} fiche(s) analysée(s), ` +
            `${totalEmails} email(s) et ${totalInsta} Instagram trouvés` +
            (remaining > 0 ? ` · ${remaining} restante(s)…` : "")
        );
        if ((data.scanned ?? 0) === 0 || remaining === 0) break;
      }
      setMessage(
        `✅ Enrichissement terminé — ${totalScanned} fiche(s) analysée(s) : ` +
          `${totalEmails} nouvel(s) email(s) et ${totalInsta} Instagram trouvés.`
      );
      router.refresh();
    } catch {
      setMessage("Erreur réseau pendant l'enrichissement.");
    } finally {
      setEnriching(false);
    }
  }

  // --- Rédaction IA ---
  const [aiWriting, setAiWriting] = useState(false);
  const [aiWritingAll, setAiWritingAll] = useState(false);
  // Tonalité (persistée localement pour être mémorisée d'une visite à l'autre).
  const [aiTone, setAiTone] = useState("equilibre");
  useEffect(() => {
    try {
      const t = window.localStorage.getItem("kado_ai_tone");
      if (t) setAiTone(t);
    } catch {
      /* localStorage indisponible → défaut */
    }
  }, []);
  function changeTone(t: string) {
    setAiTone(t);
    try {
      window.localStorage.setItem("kado_ai_tone", t);
    } catch {
      /* ignore */
    }
  }

  /** Enchaîne les lots IA jusqu'à ce qu'il ne reste plus rien (boucle côté client). */
  async function runAiWriteAll() {
    if (!window.confirm("Rédiger par IA TOUS les prospects restants ? (par lots automatiques, ça peut prendre un moment)")) return;
    setAiWritingAll(true);
    setMessage(null);
    let totalWritten = 0;
    let totalFailed = 0;
    try {
      // Garde-fou : borne le nombre de tours (10 par tour → jusqu'à ~2000 prospects).
      for (let round = 0; round < 200; round++) {
        const res = await fetch("/api/admin/prospection/ai-write", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 10, tone: aiTone }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMessage(`Erreur : ${data.error ?? "inconnue"} (arrêt après ${totalWritten} rédigé(s)).`);
          break;
        }
        if (!data.configured) {
          setMessage("IA non configurée : ajoute la variable ANTHROPIC_API_KEY dans Vercel.");
          break;
        }
        totalWritten += data.written;
        totalFailed += data.failed;
        // Progression en direct.
        setMessage(
          `✨ Rédaction IA en cours… ${totalWritten} rédigé(s)` +
            (data.remaining ? `, ${data.remaining} restant(s)` : "") +
            (totalFailed ? `, ${totalFailed} échec(s)` : "")
        );
        router.refresh();
        // Fin : plus rien de nouveau (terminé, ou seuls des échecs persistent).
        if (data.written === 0 || data.remaining === 0) break;
      }
      setMessage(
        `✨ Terminé : ${totalWritten} prospect(s) rédigé(s) par IA` +
          (totalFailed ? `, ${totalFailed} échec(s)` : "") +
          ". Messages en brouillon : relis-les puis approuve."
      );
      router.refresh();
    } catch {
      setMessage(`Erreur réseau pendant la rédaction IA (arrêt après ${totalWritten} rédigé(s)).`);
    } finally {
      setAiWritingAll(false);
    }
  }

  async function runAiWrite() {
    setAiWriting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/prospection/ai-write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone: aiTone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`Erreur : ${data.error ?? "inconnue"}`);
      } else if (!data.configured) {
        setMessage(
          "IA non configurée : ajoute la variable ANTHROPIC_API_KEY dans Vercel pour activer la rédaction par IA."
        );
      } else {
        setMessage(
          `✨ ${data.written} prospect(s) rédigé(s) par IA` +
            (data.failed ? `, ${data.failed} échec(s)` : "") +
            (data.remaining ? ` — ${data.remaining} restant(s), reclique pour continuer` : "") +
            ". Messages en brouillon : relis-les puis approuve."
        );
        router.refresh();
      }
    } catch {
      setMessage("Erreur réseau pendant la rédaction IA.");
    } finally {
      setAiWriting(false);
    }
  }

  // --- Import CSV ---
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // --- Test de délivrabilité (SPF/DKIM/DMARC/MX) ---
  const [deliv, setDeliv] = useState<DeliverabilityReport | null>(null);
  const [delivLoading, setDelivLoading] = useState(false);

  async function testDeliverability() {
    setDelivLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/prospection/deliverability");
      const data = await res.json();
      if (!res.ok) {
        setMessage(`Erreur : ${data.error ?? "inconnue"}`);
      } else {
        setDeliv(data as DeliverabilityReport);
      }
    } catch {
      setMessage("Erreur réseau (test de délivrabilité).");
    } finally {
      setDelivLoading(false);
    }
  }

  async function importCsv(file: File) {
    setImporting(true);
    setMessage(null);
    try {
      const text = await file.text();
      const { rows, unknownHeaders } = mapCsv(text);
      if (rows.length === 0) {
        setMessage(
          "Aucune ligne exploitable. Vérifie que la 1ʳᵉ ligne contient des en-têtes (ex. nom, ville, email, instagram, site, avis)."
        );
        return;
      }
      const res = await fetch("/api/admin/prospection/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`Erreur : ${data.error ?? "inconnue"}`);
      } else {
        setMessage(
          `${data.inserted} prospect(s) importé(s)` +
            (data.duplicates ? `, ${data.duplicates} doublon(s) ignoré(s)` : "") +
            ` (sur ${data.received} ligne(s) lues)` +
            (unknownHeaders.length > 0
              ? ` — colonnes ignorées : ${unknownHeaders.join(", ")}`
              : "") +
            "."
        );
        router.refresh();
      }
    } catch {
      setMessage("Erreur pendant l'import du fichier CSV.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const filtered = useMemo(() => {
    const max = maxReviews === "" ? null : Number(maxReviews);
    const rows = prospects.filter((p) => {
      if (fSegment && p.category !== fSegment) return false;
      if (fStatus && p.status !== fStatus) return false;
      if (!matchContact(p, fContact)) return false;
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
  }, [prospects, fSegment, fStatus, fContact, maxReviews, sort]);

  // Lignes pour la vue pipeline : mêmes filtres SAUF le statut (le board
  // regroupe justement par statut), triées par score décroissant.
  const boardRows = useMemo(() => {
    const max = maxReviews === "" ? null : Number(maxReviews);
    return prospects
      .filter((p) => {
        if (fSegment && p.category !== fSegment) return false;
        if (!matchContact(p, fContact)) return false;
        if (max != null && (p.google_reviews_count ?? Infinity) > max) return false;
        return true;
      })
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }, [prospects, fSegment, fContact, maxReviews]);

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
      {stats && <AnglePerf perf={stats.anglePerf} />}
      {stats && <SubjectPerf perf={stats.subjectPerf} />}
      {stats && <ConversionTables byCity={stats.byCity} bySegment={stats.bySegment} />}

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
          <CityInput
            value={city}
            onChange={setCity}
            placeholder="Ville(s) — ex. Versailles, Le Chesnay"
            title="Commence à taper : les villes sont proposées automatiquement. Plusieurs villes séparées par des virgules (5 max)."
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc", minWidth: 240, width: "100%", boxSizing: "border-box" }}
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
            onClick={() => runEnrich(false)}
            disabled={enriching}
            className="dash-signout"
            style={{ opacity: enriching ? 0.6 : 1 }}
            title="Cherche les emails et comptes Instagram réellement publiés sur les sites (jamais deviné). Passe toute la liste automatiquement."
          >
            {enriching ? "Enrichissement…" : "Enrichir (email / Insta)"}
          </button>
          <button
            onClick={() => runEnrich(true)}
            disabled={enriching}
            className="dash-signout"
            style={{ opacity: enriching ? 0.6 : 1 }}
            title="Re-scanne TOUTE la liste, même les fiches déjà tentées (utile après avoir activé Serper). Ne supprime rien."
          >
            {enriching ? "…" : "🔄 Tout ré-enrichir"}
          </button>
          <select
            value={aiTone}
            onChange={(e) => changeTone(e.target.value)}
            disabled={aiWriting || aiWritingAll}
            title="Tonalité des messages rédigés par l'IA"
            style={{ ...selectStyle, color: "#8b6cff" }}
          >
            <option value="equilibre">Ton : équilibré</option>
            <option value="direct">Ton : direct</option>
            <option value="chaleureux">Ton : chaleureux</option>
            <option value="court">Ton : court</option>
          </select>
          <button
            onClick={runAiWrite}
            disabled={aiWriting || aiWritingAll}
            className="dash-signout"
            style={{ opacity: aiWriting || aiWritingAll ? 0.6 : 1, color: "#8b6cff" }}
            title="Rédige un lot (8) de messages email + DM personnalisés par IA (brouillons à valider). Nécessite ANTHROPIC_API_KEY."
          >
            {aiWriting ? "Rédaction IA…" : "✨ Rédiger avec l'IA (lot)"}
          </button>
          <button
            onClick={runAiWriteAll}
            disabled={aiWriting || aiWritingAll}
            className="dash-signout"
            style={{ opacity: aiWriting || aiWritingAll ? 0.6 : 1, color: "#8b6cff", fontWeight: 600 }}
            title="Rédige par IA TOUS les prospects restants, lot après lot, automatiquement."
          >
            {aiWritingAll ? "Rédaction en cours…" : "✨ Tout rédiger (IA)"}
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
          <button
            onClick={testDeliverability}
            disabled={delivLoading}
            className="dash-signout"
            style={{ opacity: delivLoading ? 0.6 : 1 }}
            title="Vérifie SPF / DKIM / DMARC / MX de ton domaine d'envoi (anti-spam)"
          >
            {delivLoading ? "Test…" : "🛡️ Test délivrabilité"}
          </button>
        </div>

        {deliv && <DeliverabilityPanel report={deliv} onClose={() => setDeliv(null)} />}
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
      <div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="dash-signout"
          style={{ fontSize: 13 }}
        >
          {showAdd ? "Annuler" : "➕ Ajouter un prospect à la main"}
        </button>
        {/* Import CSV */}
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importCsv(f);
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className="dash-signout"
          style={{ fontSize: 13, opacity: importing ? 0.6 : 1 }}
          title="Importer une liste de prospects depuis un fichier CSV (colonnes : nom, ville, email, instagram, site, avis…)"
        >
          {importing ? "Import…" : "📥 Importer un CSV"}
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
        <select
          value={fContact}
          onChange={(e) => setFContact(e.target.value)}
          style={selectStyle}
          title="Filtrer selon la présence d'un email et/ou d'un compte Instagram"
        >
          {CONTACT_FILTERS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
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
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} style={selectStyle} disabled={view === "pipeline"} title={view === "pipeline" ? "Tri par score dans la vue pipeline" : undefined}>
          <option value="score">Tri : score</option>
          <option value="reviews">Tri : moins d'avis</option>
          <option value="rating">Tri : meilleure note</option>
          <option value="name">Tri : nom</option>
        </select>
        {/* Bascule Liste / Pipeline */}
        <div style={{ display: "inline-flex", borderRadius: 8, overflow: "hidden", border: "1px solid #ccc" }}>
          <button
            onClick={() => setView("list")}
            className="dash-signout"
            style={{ fontSize: 13, border: "none", borderRadius: 0, background: view === "list" ? "#8b6cff" : "#fff", color: view === "list" ? "#fff" : "#555" }}
            title="Vue liste détaillée"
          >
            ☰ Liste
          </button>
          <button
            onClick={() => setView("pipeline")}
            className="dash-signout"
            style={{ fontSize: 13, border: "none", borderRadius: 0, background: view === "pipeline" ? "#8b6cff" : "#fff", color: view === "pipeline" ? "#fff" : "#555" }}
            title="Vue pipeline (kanban par statut)"
          >
            ▦ Pipeline
          </button>
        </div>
        <span style={{ marginLeft: "auto", color: "#666", fontSize: 14 }}>
          {(view === "pipeline" ? boardRows.length : filtered.length)} prospect(s)
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

      {/* --- Liste / Pipeline --- */}
      {view === "pipeline" ? (
        boardRows.length === 0 ? (
          <p style={{ color: "#666" }}>
            Aucun prospect. Lance un sourcing ci-dessus pour commencer.
          </p>
        ) : (
          <PipelineBoard rows={boardRows} onStatus={changeStatus} />
        )
      ) : filtered.length === 0 ? (
        <p style={{ color: "#666" }}>
          Aucun prospect. Lance un sourcing ci-dessus pour commencer.
        </p>
      ) : (
        <div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", margin: "2px 0 10px", fontSize: 12, color: "#666" }}>
            <span>États Email / DM :</span>
            <Pill {...PILL.sent} />
            <Pill {...PILL.approved} />
            <Pill {...PILL.draft} />
            <Pill {...PILL.none} />
          </div>

          {isMobile ? (
            /* --- Mobile : cartes empilées --- */
            <div style={{ display: "grid", gap: 10 }}>
              {paged.map((p) => (
                <ProspectCard key={p.id} p={p} onStatus={changeStatus} />
              ))}
            </div>
          ) : (
            /* --- Bureau : tableau --- */
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
                        <StatusSelect p={p} onStatus={changeStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

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

/** Tableaux de conversion par ville et par secteur (taux de réponse). */
function ConversionTables({
  byCity,
  bySegment,
}: {
  byCity: ConversionRow[];
  bySegment: ConversionRow[];
}) {
  if (byCity.length === 0 && bySegment.length === 0) return null;

  const Table = ({ title, rows, labelFor }: { title: string; rows: ConversionRow[]; labelFor: (k: string) => string }) => {
    if (rows.length === 0) return null;
    // Meilleur taux parmi les lignes assez contactées (fiabilité).
    const eligible = rows.filter((r) => r.contacted >= 5);
    const best = eligible.length
      ? eligible.reduce((a, b) => (b.replied / b.contacted > a.replied / a.contacted ? b : a))
      : null;
    return (
      <div style={{ flex: "1 1 320px", minWidth: 280 }}>
        <h4 style={{ margin: "0 0 6px" }}>{title}</h4>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "2px solid #eee" }}>
                <th style={th}>{title.includes("ville") ? "Ville" : "Secteur"}</th>
                <th style={th}>Contactés</th>
                <th style={th}>Réponses</th>
                <th style={th}>Taux</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const rate = r.contacted > 0 ? Math.round((r.replied / r.contacted) * 100) : 0;
                const isBest = Boolean(best && r.key === best.key && r.contacted >= 5);
                return (
                  <tr key={r.key} style={{ borderBottom: "1px solid #f0f0f0", background: isBest ? "#e6f4ea" : undefined }}>
                    <td style={td}>{labelFor(r.key)} {isBest && "🏆"}</td>
                    <td style={td}>{r.contacted}</td>
                    <td style={td}>{r.replied}{r.clients ? ` (${r.clients} client${r.clients > 1 ? "s" : ""})` : ""}</td>
                    <td style={td}>{rate}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 14, margin: "0 0 16px" }}>
      <h3 style={{ margin: "0 0 2px" }}>📈 Conversion par ville & secteur</h3>
      <p style={{ color: "#666", marginTop: 0, fontSize: 13 }}>
        Où tes efforts convertissent le mieux (réponses / contactés). Concentre-toi
        sur les 🏆.
      </p>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <Table title="Par ville" rows={byCity} labelFor={(k) => k} />
        <Table
          title="Par secteur"
          rows={bySegment}
          labelFor={(k) => SEGMENT_LABEL[k as ProspectSegment] ?? k}
        />
      </div>
      <p style={{ color: "#999", fontSize: 12, marginBottom: 0 }}>
        Un taux n'est fiable qu'à partir de ~10 contactés. 🏆 = meilleur taux à ce stade.
      </p>
    </div>
  );
}

/**
 * Tableau « Test A/B des emails » : compare le taux de réponse des deux angles
 * d'accroche (Question curieuse vs Approche directe). Chaque prospect reçoit un
 * angle de façon automatique (~50/50) ; on garde ensuite celui qui répond le mieux.
 */
function AnglePerf({ perf }: { perf: Stats["anglePerf"] }) {
  const totalSent = perf.reduce((s, p) => s + p.sent, 0);
  // On affiche TOUJOURS le tableau (même à 0 envoi) pour montrer que le test A/B
  // est actif ; il se remplira dès les premiers emails partis.

  const eligible = perf.filter((p) => p.sent >= 5);
  const best =
    eligible.length > 0
      ? eligible.reduce((a, b) => (b.replied / b.sent > a.replied / a.sent ? b : a))
      : null;

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 14, margin: "0 0 16px" }}>
      <h3 style={{ margin: "0 0 2px" }}>🧪 Test A/B des emails (IA)</h3>
      <p style={{ color: "#666", marginTop: 0, fontSize: 13 }}>
        Deux façons d&apos;aborder le prospect sont testées automatiquement (une
        moitié chacune). On garde celle qui obtient le plus de réponses.
      </p>
      {totalSent === 0 && (
        <p
          style={{
            background: "#eef2ff",
            border: "1px solid #e0e7ff",
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 13,
            color: "#3730a3",
            margin: "0 0 10px",
          }}
        >
          ✅ Le test A/B est <strong>actif</strong>. Les chiffres ci-dessous se
          rempliront dès que tu auras <strong>envoyé des emails</strong> (colonne
          « Envoyés »), et le taux de réponse s&apos;affichera au fil des retours.
        </p>
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #eee" }}>
              <th style={th}>Variante</th>
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
                    {p.label} {isBest && "🏆"}
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
        <strong>Question curieuse</strong> = on pose une vraie question sans dire
        tout de suite qu&apos;on vend un outil. <strong>Approche directe</strong> =
        on annonce Kado dès la 1ʳᵉ phrase. Un taux devient fiable à partir de
        ~15–20 envois par variante. 🏆 = meilleure variante à ce stade.
      </p>
    </div>
  );
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

/** Menu déroulant de statut (réutilisé tableau + carte). */
function StatusSelect({
  p,
  onStatus,
  full,
}: {
  p: ProspectRow;
  onStatus: (id: string, s: ProspectStatus) => void;
  full?: boolean;
}) {
  return (
    <select
      value={p.status}
      onChange={(e) => onStatus(p.id, e.target.value as ProspectStatus)}
      style={{
        padding: "6px 8px",
        borderRadius: 6,
        border: "1px solid #ccc",
        fontSize: 13,
        width: full ? "100%" : undefined,
      }}
    >
      {(Object.keys(STATUS_LABEL) as ProspectStatus[]).map((s) => (
        <option key={s} value={s}>
          {STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}

/** Carte d'un prospect (affichage mobile). */
function ProspectCard({
  p,
  onStatus,
}: {
  p: ProspectRow;
  onStatus: (id: string, s: ProspectStatus) => void;
}) {
  const meta = [
    p.city,
    p.category ? SEGMENT_LABEL[p.category as ProspectSegment] ?? p.category : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
        <a href={`/admin/prospection/${p.id}`} style={{ fontWeight: 600, fontSize: 15 }}>
          {p.name}
        </a>
        <span style={{ fontSize: 12, color: "#888", whiteSpace: "nowrap" }}>
          Score {p.score ?? "—"}
        </span>
      </div>
      <div style={{ fontSize: 13, color: "#666", margin: "3px 0 8px" }}>
        {meta}
        {meta && " · "}⭐ {p.google_rating ?? "—"} · {p.google_reviews_count ?? "—"} avis
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 13, marginBottom: 8 }}>
        {p.email && <a href={`mailto:${p.email}`}>✉️ {p.email}</a>}
        {p.instagram_handle && (
          <a href={`https://instagram.com/${p.instagram_handle}`} target="_blank" rel="noreferrer">
            📸 @{p.instagram_handle}
          </a>
        )}
        {p.website && (
          <a href={p.website} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
            site ↗
          </a>
        )}
        {!p.email && !p.instagram_handle && <span style={{ color: "#999" }}>Pas de contact</span>}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: "#888" }}>Email</span>
        <EmailBadge p={p} />
        <span style={{ fontSize: 12, color: "#888", marginLeft: 6 }}>DM</span>
        <DmBadge p={p} />
      </div>
      <StatusSelect p={p} onStatus={onStatus} full />
    </div>
  );
}

/** Panneau de résultat du test de délivrabilité (SPF/DKIM/DMARC/MX). */
function DeliverabilityPanel({
  report,
  onClose,
}: {
  report: DeliverabilityReport;
  onClose: () => void;
}) {
  const scoreColor =
    report.score >= 85 ? "#1e7d34" : report.score >= 60 ? "#a86b00" : "#c0392b";
  const badge: Record<DeliverabilityCheck["status"], { txt: string; bg: string; color: string }> = {
    ok: { txt: "✓ OK", bg: "#e6f4ea", color: "#1e7d34" },
    warn: { txt: "⚠ À surveiller", bg: "#fff4e0", color: "#a86b00" },
    fail: { txt: "✗ Problème", bg: "#fdecea", color: "#c0392b" },
  };
  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 12,
        padding: 14,
        marginTop: 12,
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>🛡️ Délivrabilité</h3>
        {report.domain && (
          <code style={{ fontSize: 13, color: "#555" }}>{report.domain}</code>
        )}
        <span
          style={{
            marginLeft: "auto",
            fontWeight: 800,
            fontSize: 20,
            color: scoreColor,
          }}
          title="Score de configuration (0-100)"
        >
          {report.score}/100
        </span>
        <button onClick={onClose} className="dash-signout" style={{ fontSize: 12 }}>
          Fermer
        </button>
      </div>
      <p style={{ color: "#444", fontSize: 14, margin: "6px 0 10px" }}>{report.summary}</p>
      {report.configured ? (
        <div style={{ display: "grid", gap: 8 }}>
          {report.checks.map((c) => (
            <div
              key={c.key}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                border: "1px solid #f0f0f0",
                borderRadius: 8,
                padding: "8px 10px",
              }}
            >
              <span
                style={{
                  flex: "0 0 auto",
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: badge[c.status].bg,
                  color: badge[c.status].color,
                  whiteSpace: "nowrap",
                }}
              >
                {badge[c.status].txt}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{c.label}</div>
                <div style={{ fontSize: 13, color: "#555", wordBreak: "break-word" }}>{c.detail}</div>
                {c.help && (
                  <div style={{ fontSize: 12, color: "#a86b00", marginTop: 2 }}>💡 {c.help}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 13, color: "#c0392b" }}>
          Configure d&apos;abord l&apos;expéditeur de prospection (variable{" "}
          <code>PROSPECT_EMAIL_FROM</code>) puis relance le test.
        </p>
      )}
      <p style={{ fontSize: 12, color: "#999", marginBottom: 0, marginTop: 10 }}>
        Contrôle DNS gratuit (aucun email envoyé). Pour un score anti-spam complet
        (contenu, blacklists), tu peux compléter avec un outil comme mail-tester.com.
      </p>
    </div>
  );
}

/** Vue pipeline (kanban) : une colonne par étape, cartes déplaçables via le statut. */
function PipelineBoard({
  rows,
  onStatus,
}: {
  rows: ProspectRow[];
  onStatus: (id: string, s: ProspectStatus) => void;
}) {
  // Regroupe chaque prospect dans la 1ʳᵉ colonne contenant son statut.
  const byColumn: Record<string, ProspectRow[]> = {};
  for (const col of PIPELINE_COLUMNS) byColumn[col.key] = [];
  for (const p of rows) {
    const col = PIPELINE_COLUMNS.find((c) => c.statuses.includes(p.status));
    if (col) byColumn[col.key].push(p);
  }

  return (
    <div style={{ overflowX: "auto", paddingBottom: 6 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", minWidth: "min-content" }}>
        {PIPELINE_COLUMNS.map((col) => {
          const items = byColumn[col.key];
          return (
            <div
              key={col.key}
              style={{
                flex: "0 0 260px",
                width: 260,
                background: "#faf9fc",
                border: "1px solid #eee",
                borderRadius: 12,
                padding: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 8,
                  paddingBottom: 6,
                  borderBottom: `2px solid ${col.accent}`,
                }}
              >
                <span style={{ fontSize: 15 }}>{col.emoji}</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: "#222" }}>{col.label}</span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 12,
                    fontWeight: 700,
                    color: col.accent,
                    background: "#fff",
                    border: `1px solid ${col.accent}33`,
                    borderRadius: 999,
                    padding: "1px 8px",
                  }}
                >
                  {items.length}
                </span>
              </div>
              <div style={{ display: "grid", gap: 8, maxHeight: 560, overflowY: "auto" }}>
                {items.length === 0 ? (
                  <p style={{ color: "#bbb", fontSize: 13, textAlign: "center", margin: "10px 0" }}>—</p>
                ) : (
                  items.map((p) => <PipelineCard key={p.id} p={p} onStatus={onStatus} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Carte compacte dans une colonne de pipeline. */
function PipelineCard({
  p,
  onStatus,
}: {
  p: ProspectRow;
  onStatus: (id: string, s: ProspectStatus) => void;
}) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 10, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "baseline" }}>
        <a href={`/admin/prospection/${p.id}`} style={{ fontWeight: 600, fontSize: 14 }}>
          {p.name}
        </a>
        <span style={{ fontSize: 11, color: "#888", whiteSpace: "nowrap" }}>{p.score ?? "—"}</span>
      </div>
      <div style={{ fontSize: 12, color: "#666", margin: "2px 0 6px" }}>
        {[p.city, p.category ? SEGMENT_LABEL[p.category as ProspectSegment] ?? p.category : null]
          .filter(Boolean)
          .join(" · ") || "—"}
      </div>
      <div style={{ display: "flex", gap: 8, fontSize: 12, marginBottom: 8 }}>
        {p.email && <span title={p.email}>✉️</span>}
        {p.instagram_handle && (
          <a href={`https://instagram.com/${p.instagram_handle}`} target="_blank" rel="noreferrer" title={`@${p.instagram_handle}`}>
            📸
          </a>
        )}
        {!p.email && !p.instagram_handle && <span style={{ color: "#bbb" }}>Pas de contact</span>}
      </div>
      <StatusSelect p={p} onStatus={onStatus} full />
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
