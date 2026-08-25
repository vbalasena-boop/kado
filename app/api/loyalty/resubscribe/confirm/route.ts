import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { escapeHtml } from "@/lib/campaigns";
import { decodeEmail, verifyResubToken } from "@/lib/resubscribe";

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

/** GET : affiche la page de confirmation (aucune modification). */
export async function GET(req: NextRequest) {
  const p = readParams(new URL(req.url));
  const ok = !!p.b && !!p.email && !!p.t && verifyResubToken(p.b, p.email, p.exp, p.t);
  if (!ok) return htmlResponse(INVALID, 400);

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

  if (!b || !email || !t || !verifyResubToken(b, email, exp, t)) {
    return htmlResponse(INVALID, 400);
  }

  let changed = 0;
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
  } catch {
    /* tolérant */
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
