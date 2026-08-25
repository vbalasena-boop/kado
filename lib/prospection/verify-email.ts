/**
 * Prospection Kado — vérification d'un email AVANT envoi (backlog AI-5).
 *
 * But : éviter les bounces (adresses invalides / domaines sans mail) qui abîment
 * la réputation d'expéditeur — priorité n°1. Contrôle en deux temps :
 *  1. Format (déterministe, gratuit).
 *  2. Enregistrement MX du domaine (le domaine peut-il recevoir des emails ?).
 *
 * Prudence : une erreur DNS *transitoire* ne doit jamais exclure une adresse à
 * tort → elle renvoie « unknown » (on envoie quand même). Seuls un mauvais
 * format ou un domaine sans MX (NXDOMAIN/ENODATA) sont considérés invalides.
 */
import { promises as dns } from "dns";

export type EmailVerdict = "ok" | "bad_format" | "no_mx" | "unknown";

/** Validation de forme minimale mais robuste (une seule @, domaine avec TLD). */
export function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export type MxResolver = (domain: string) => Promise<{ exchange: string }[]>;

/**
 * Rend un verdict sur une adresse email. `resolveMx` est injectable (tests).
 * Ne lève jamais.
 */
export async function verifyEmail(
  email: string,
  resolveMx: MxResolver = (d) => dns.resolveMx(d)
): Promise<EmailVerdict> {
  if (!isValidEmailFormat(email)) return "bad_format";
  const domain = email.trim().split("@")[1].toLowerCase();
  try {
    const mx = await resolveMx(domain);
    return mx && mx.length > 0 ? "ok" : "no_mx";
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    // Domaine inexistant / sans enregistrement → définitivement pas d'email.
    if (code === "ENOTFOUND" || code === "ENODATA") return "no_mx";
    // Erreur transitoire (timeout, serveur DNS) → on n'exclut pas.
    return "unknown";
  }
}
