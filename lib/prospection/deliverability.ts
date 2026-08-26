/**
 * Prospection Kado — test de délivrabilité du domaine d'envoi (SPF/DKIM/DMARC/MX).
 *
 * Interroge le DNS du domaine expéditeur (déduit de PROSPECT_EMAIL_FROM) et
 * produit un rapport lisible : chaque contrôle est « ok / à surveiller /
 * problème », avec un conseil concret. Un score global (0-100) résume l'état.
 *
 * Ce n'est PAS un envoi vers un service de scoring externe (mail-tester…) : on
 * reste 100 % gratuit et sans dépendance, en vérifiant la configuration DNS qui
 * conditionne l'essentiel de la délivrabilité et évite le classement en spam.
 */

export type CheckStatus = "ok" | "warn" | "fail";

export type DeliverabilityCheck = {
  key: "mx" | "spf" | "dkim" | "dmarc";
  label: string;
  status: CheckStatus;
  detail: string;
  help?: string;
};

export type DeliverabilityReport = {
  domain: string | null;
  configured: boolean;
  checks: DeliverabilityCheck[];
  score: number; // 0-100
  summary: string;
};

export type DnsResolvers = {
  resolveMx: (host: string) => Promise<{ exchange: string; priority: number }[]>;
  resolveTxt: (host: string) => Promise<string[][]>;
};

// Sélecteurs DKIM courants à sonder (OVH + génériques). Le sélecteur réel est
// propre à chaque config ; on tente les plus répandus.
const DKIM_SELECTORS = [
  "ovhmx1",
  "ovhmx2",
  "ovhmx3",
  "mail",
  "default",
  "selector1",
  "selector2",
  "dkim",
  "google",
  "k1",
  "s1",
  "s2",
];

// Poids de chaque contrôle dans le score global.
const WEIGHTS: Record<DeliverabilityCheck["key"], number> = {
  mx: 20,
  spf: 30,
  dkim: 25,
  dmarc: 25,
};

/** Extrait le domaine d'une adresse « Nom <a@b.fr> » ou « a@b.fr ». */
export function domainFromAddress(from?: string | null): string | null {
  if (!from) return null;
  const m = from.match(/<([^>]+)>/);
  const addr = (m ? m[1] : from).trim();
  const at = addr.lastIndexOf("@");
  if (at < 0) return null;
  const domain = addr
    .slice(at + 1)
    .trim()
    .toLowerCase()
    .replace(/[>\s]+$/, "");
  return domain || null;
}

/** Joint les segments d'un enregistrement TXT (le DNS découpe à 255 caractères). */
function joinTxt(record: string[]): string {
  return record.join("");
}

async function safeTxt(resolveTxt: DnsResolvers["resolveTxt"], host: string): Promise<string[]> {
  try {
    const records = await resolveTxt(host);
    return records.map(joinTxt);
  } catch {
    return [];
  }
}

/**
 * Construit le rapport de délivrabilité pour un domaine, à partir de
 * résolveurs DNS injectables (facile à tester).
 */
export async function buildDeliverabilityReport(
  domain: string | null,
  dns: DnsResolvers
): Promise<DeliverabilityReport> {
  if (!domain) {
    return {
      domain: null,
      configured: false,
      checks: [],
      score: 0,
      summary:
        "Aucun domaine d'envoi configuré (PROSPECT_EMAIL_FROM). Configure l'expéditeur de prospection avant de tester la délivrabilité.",
    };
  }

  const checks: DeliverabilityCheck[] = [];

  // --- MX ---
  try {
    const mx = await dns.resolveMx(domain);
    if (mx.length > 0) {
      const top = [...mx].sort((a, b) => a.priority - b.priority)[0];
      checks.push({
        key: "mx",
        label: "MX (réception)",
        status: "ok",
        detail: `${mx.length} serveur(s) — principal : ${top.exchange}`,
      });
    } else {
      checks.push({
        key: "mx",
        label: "MX (réception)",
        status: "fail",
        detail: "Aucun enregistrement MX.",
        help: "Sans MX, tu ne peux pas recevoir les réponses ni les bounces. Configure les MX chez ton hébergeur mail.",
      });
    }
  } catch {
    checks.push({
      key: "mx",
      label: "MX (réception)",
      status: "fail",
      detail: "Aucun enregistrement MX trouvé.",
      help: "Sans MX, tu ne peux pas recevoir les réponses ni les bounces. Configure les MX chez ton hébergeur mail.",
    });
  }

  // --- SPF ---
  const txt = await safeTxt(dns.resolveTxt, domain);
  const spfRecords = txt.filter((t) => /v=spf1/i.test(t));
  if (spfRecords.length === 1) {
    checks.push({
      key: "spf",
      label: "SPF",
      status: "ok",
      detail: spfRecords[0].length > 90 ? spfRecords[0].slice(0, 90) + "…" : spfRecords[0],
    });
  } else if (spfRecords.length > 1) {
    checks.push({
      key: "spf",
      label: "SPF",
      status: "warn",
      detail: `${spfRecords.length} enregistrements SPF (il ne doit y en avoir qu'un).`,
      help: "Plusieurs SPF invalident le contrôle. Fusionne-les en un seul enregistrement v=spf1.",
    });
  } else {
    checks.push({
      key: "spf",
      label: "SPF",
      status: "fail",
      detail: "Aucun enregistrement SPF.",
      help: "Ajoute un TXT « v=spf1 include:… ~all » autorisant ton serveur d'envoi (ex. OVH).",
    });
  }

  // --- DKIM ---
  let dkimFound: string | null = null;
  for (const sel of DKIM_SELECTORS) {
    const recs = await safeTxt(dns.resolveTxt, `${sel}._domainkey.${domain}`);
    if (recs.some((r) => /v=DKIM1|p=/i.test(r))) {
      dkimFound = sel;
      break;
    }
  }
  if (dkimFound) {
    checks.push({
      key: "dkim",
      label: "DKIM",
      status: "ok",
      detail: `Clé publiée (sélecteur « ${dkimFound} »).`,
    });
  } else {
    checks.push({
      key: "dkim",
      label: "DKIM",
      status: "warn",
      detail: "Aucune clé DKIM trouvée sur les sélecteurs courants.",
      help: "Le sélecteur DKIM peut être spécifique. Vérifie dans l'admin de ton hébergeur mail que DKIM est activé et publié.",
    });
  }

  // --- DMARC ---
  const dmarcTxt = await safeTxt(dns.resolveTxt, `_dmarc.${domain}`);
  const dmarc = dmarcTxt.find((t) => /v=DMARC1/i.test(t));
  if (dmarc) {
    const policy = (dmarc.match(/p=\s*(none|quarantine|reject)/i)?.[1] || "none").toLowerCase();
    if (policy === "none") {
      checks.push({
        key: "dmarc",
        label: "DMARC",
        status: "warn",
        detail: "Présent mais en politique « none » (surveillance uniquement).",
        help: "Passe progressivement à p=quarantine puis p=reject une fois SPF/DKIM stables.",
      });
    } else {
      checks.push({
        key: "dmarc",
        label: "DMARC",
        status: "ok",
        detail: `Politique « ${policy} ».`,
      });
    }
  } else {
    checks.push({
      key: "dmarc",
      label: "DMARC",
      status: "fail",
      detail: "Aucun enregistrement DMARC.",
      help: "Ajoute un TXT sur _dmarc." + domain + " : « v=DMARC1; p=none; rua=mailto:… » pour commencer.",
    });
  }

  // --- Score global ---
  let score = 0;
  for (const c of checks) {
    const w = WEIGHTS[c.key];
    score += c.status === "ok" ? w : c.status === "warn" ? w / 2 : 0;
  }
  score = Math.round(score);

  const fails = checks.filter((c) => c.status === "fail").length;
  const warns = checks.filter((c) => c.status === "warn").length;
  const summary =
    fails === 0 && warns === 0
      ? "Configuration saine : SPF, DKIM et DMARC sont en place. 👍"
      : fails > 0
        ? `${fails} problème(s) bloquant(s) à corriger avant d'envoyer (risque de spam/blacklist).`
        : `${warns} point(s) à améliorer pour renforcer la délivrabilité.`;

  return { domain, configured: true, checks, score, summary };
}
