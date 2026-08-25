import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { escapeHtml } from "@/lib/campaigns";
import { decodeEmail, verifyResubToken } from "@/lib/resubscribe";
import { reportError } from "@/lib/report";

export const dynamic = "force-dynamic";

/**
 * Confirmation de ré-abonnement (double opt-in, étape 2/2).
 *
 * IMPORTANT (RGPD) : le rétablissement du consentement est un ACTE DÉLIBÉRÉ.
 * Le GET n'affiche qu'une page avec un bouton — il ne modifie RIEN — pour ne
 * pas être déclenché par les prefetch / scanners d'e-mail (Gmail, Outlook
 * SafeLinks…). Seul le POST (clic sur le bouton) rétablit le consentement.
 * Idempotent : on ne réactive que si la carte est ENCORE désinscrite ;
 * rejouer/recliquer ne change plus rien.
 */

type Params = { b: string; email: string; exp: number; t: string; e64: string };

function readParams(url: URL): Params {
  const b = url.searchParams.get("b") || "";
  const e64 = url.searchParams.get("e") || "";
  const t = url.searchParams.get("t") || "";
  return {
    b,
    e64,
    email: decodeEmail(e64),
    exp: Number(url.searchParams.get("exp") || ""),
    t,
  };
}

function page(opts: {
  emoji: string;
  title: string;
  body: string;
  formHtml?: string;
}): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Ré-abonnement</title></head>
<body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#17092e;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
<div style="background:#fff;border-radius:20px;padding:36px;max-width:420px;text-align:center;margin:16px;">
<div style="font-size:44px;margin-bottom:10px;">${opts.emoji}</div>
<h1 style="font-size:20px;color:#1b1035;margin:0 0 10px;">${opts.title}</h1>
<p style="color:#40396a;font-size:15px;line-height:1.6;margin:0 0 18px;">${opts.body}</p>
${opts.formHtml ?? ""}
</div></body></html>`;
}

function htmlResponse(html: string, status: number): Response {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Réponse mutante/sensible : jamais mise en cache par un intermédiaire.
      "Cache-Control": "no-store",
    },
  });
}

const INVALID = page({
  emoji: "🤔",
  title: "Lien invalide ou expiré",
  body: "Ce lien de ré-abonnement est incomplet, invalide ou expiré. Vous pouvez relancer une demande depuis votre carte de fidélité.",
});

// Blip DB (lecture en échec) : ce N'EST PAS un lien invalide → on invite à
// réessayer plus tard plutôt que d'afficher un « invalide » définitif.
const RETRY = page({
  emoji: "⏳",
  title: "Réessayez dans un instant",
  body: "Un incident technique temporaire empêche de traiter votre ré-abonnement. Merci de recliquer sur le lien dans quelques instants.",
});

// Re-clic bénin sur un lien déjà utilisé (carte déjà ré-abonnée) : message
// amical plutôt qu'une erreur.
const ALREADY = page({
  emoji: "🎉",
  title: "Déjà ré-abonné(e)",
  body: "Votre ré-abonnement est déjà confirmé. Vous recevrez les offres de ce commerce par e-mail.",
});

type VerifyResult = {
  ok: boolean;
  cardId: string | null;
  alreadySubscribed: boolean;
  readError: boolean;
};

/**
 * Re-lit la carte pour re-dériver l'`unsubscribed_at` COURANT, puis vérifie le
 * token contre cet état (usage unique : un jeton signé pour un ancien état ne
 * valide plus). `unsubAt` ne transite JAMAIS par l'URL — il est relu ici.
 * Ne lève jamais. Distingue 3 issues d'échec :
 *  - `readError` : la lecture DB a levé/échoué (blip → 503, pas « invalide »).
 *  - `alreadySubscribed` : la carte existe ET `unsubscribed_at IS NULL`
 *    (re-clic bénin sur un lien déjà utilisé → page « déjà ré-abonné »).
 *  - sinon : lien réellement invalide/expiré/falsifié → 400.
 */
async function verifyAgainstCard(
  p: { b: string; email: string; exp: number; t: string },
  nowMs: number = Date.now()
): Promise<VerifyResult> {
  // Pré-contrôle structurel : évite une lecture DB pour un lien évidemment KO.
  if (!p.b || !p.email || !p.t || !Number.isFinite(p.exp) || !(p.exp > nowMs)) {
    return { ok: false, cardId: null, alreadySubscribed: false, readError: false };
  }
  let data: { id?: string; unsubscribed_at?: string | null } | null = null;
  try {
    const db = getAdminClient();
    const { data: row, error } = await db
      .from("loyalty_cards")
      .select("id, unsubscribed_at")
      .eq("business_id", p.b)
      .eq("email", p.email)
      .maybeSingle();
    if (error) {
      return { ok: false, cardId: null, alreadySubscribed: false, readError: true };
    }
    data = (row as { id?: string; unsubscribed_at?: string | null } | null) ?? null;
  } catch {
    return { ok: false, cardId: null, alreadySubscribed: false, readError: true };
  }
  const unsubAt = (data?.unsubscribed_at as string | null) ?? null;
  const cardId = (data?.id as string | null) ?? null;
  const alreadySubscribed = !!data && unsubAt == null;
  const ok = verifyResubToken(p.b, p.email, p.exp, unsubAt, p.t, nowMs);
  return { ok, cardId, alreadySubscribed, readError: false };
}

/**
 * Traduit un échec de vérification en réponse HTTP appropriée (logique
 * partagée GET/POST). N'est appelée que lorsque `result.ok === false`.
 */
function verifyFailureResponse(result: VerifyResult): Response {
  if (result.readError) return htmlResponse(RETRY, 503);
  if (result.alreadySubscribed) return htmlResponse(ALREADY, 200);
  return htmlResponse(INVALID, 400);
}

/** GET : affiche la page de confirmation (aucune modification). */
export async function GET(req: NextRequest) {
  // Anti-abus : limite plus large que le POST (le GET n'est qu'une lecture).
  if (!(await rateLimit(`resubconfirm:${clientIp(req)}`, 30, 60))) {
    return htmlResponse(INVALID, 429);
  }
  const p = readParams(new URL(req.url));
  const result = await verifyAgainstCard(p);
  if (!result.ok) return verifyFailureResponse(result);

  // Nom du commerce (lecture tolérante, purement cosmétique).
  let name = "ce commerce";
  try {
    const db = getAdminClient();
    const { data: biz } = await db
      .from("businesses")
      .select("name")
      .eq("id", p.b)
      .maybeSingle();
    if (biz?.name) name = biz.name;
  } catch {
    /* nom indisponible : libellé générique */
  }

  const formHtml = `<form method="POST" action="/api/loyalty/resubscribe/confirm">
<input type="hidden" name="b" value="${escapeHtml(p.b)}">
<input type="hidden" name="e" value="${escapeHtml(p.e64)}">
<input type="hidden" name="exp" value="${escapeHtml(String(p.exp))}">
<input type="hidden" name="t" value="${escapeHtml(p.t)}">
<button type="submit" style="border:none;cursor:pointer;background:linear-gradient(135deg,#ff6b4a,#ff4e87);color:#fff;font-weight:700;font-size:16px;padding:14px 26px;border-radius:12px;">Oui, me ré-abonner</button>
</form>`;

  return htmlResponse(
    page({
      emoji: "💌",
      title: "Confirmer votre ré-abonnement",
      body: `Vous recevrez de nouveau les offres de <b>${escapeHtml(name)}</b> par e-mail. Cliquez pour confirmer votre consentement.`,
      formHtml,
    }),
    200
  );
}

/** POST : acte délibéré → rétablit le consentement (si encore désinscrit). */
export async function POST(req: NextRequest) {
  // Anti-abus : le POST est l'étape qui écrit.
  if (!(await rateLimit(`resubconfirm:${clientIp(req)}`, 10, 60))) {
    return htmlResponse(INVALID, 429);
  }

  let b = "",
    e64 = "",
    t = "",
    expRaw = "";
  try {
    const form = await req.formData();
    b = String(form.get("b") || "");
    e64 = String(form.get("e") || "");
    t = String(form.get("t") || "");
    expRaw = String(form.get("exp") || "");
  } catch {
    return htmlResponse(INVALID, 400);
  }
  const email = decodeEmail(e64);
  const exp = Number(expRaw);

  // Re-lecture de la carte + vérification liée à l'état COURANT (usage unique).
  const result = await verifyAgainstCard({ b, email, exp, t });
  if (!result.ok) {
    return verifyFailureResponse(result);
  }

  let changed = 0;
  let updatedId: string | null = null;
  try {
    const db = getAdminClient();
    // On ne réactive QUE si la carte est encore désinscrite (idempotence +
    // pas de réactivation surprise d'un abonné déjà actif). `select` pour
    // compter les lignes réellement modifiées.
    const { data } = await db
      .from("loyalty_cards")
      .update({ unsubscribed_at: null, marketing_ok: true })
      .eq("business_id", b)
      .eq("email", email)
      .not("unsubscribed_at", "is", null)
      .select("id");
    changed = Array.isArray(data) ? data.length : 0;
    updatedId = changed > 0 ? ((data![0] as any)?.id ?? null) : null;
  } catch {
    /* tolérant */
  }

  // Audit RGPD (best-effort) : trace horodatée du rétablissement du
  // consentement. Jamais bloquant — le ré-abonnement reste acté si l'écriture
  // du journal échoue. `card_id` = id de la ligne RÉELLEMENT modifiée (fiable),
  // avec repli sur l'id pré-lu.
  if (changed > 0) {
    try {
      const db = getAdminClient();
      await db.from("consent_events").insert({
        type: "resubscribe_confirmed",
        source: "confirm_route",
        business_id: b,
        email,
        card_id: updatedId ?? result.cardId,
      });
    } catch (err) {
      reportError(err, { where: "loyalty.resubscribe.confirm.audit" });
    }
  }

  // Succès si une ligne a changé, OU si la carte est déjà ré-abonnée (rejeu
  // idempotent). On distingue « déjà à jour » pour rester honnête.
  const already = changed === 0;
  return htmlResponse(
    page({
      emoji: "🎉",
      title: already ? "Déjà ré-abonné(e)" : "Vous êtes ré-abonné(e) !",
      body: already
        ? "Votre ré-abonnement était déjà confirmé. Vous recevrez les offres de ce commerce par e-mail."
        : "C'est confirmé : vous recevrez de nouveau les offres de ce commerce par e-mail.",
    }),
    200
  );
}
