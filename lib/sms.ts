import { reportError } from "@/lib/report";

/**
 * Envoi de SMS transactionnels (« votre commande est prête »).
 *
 * Fournisseur : SMSPartner (français, ~0,04 €/SMS). La clé API passe dans
 * l'URL (`?apiKey=`), pas dans un en-tête — c'est la convention de leur API v1.
 * Le compte doit être validé par SMSPartner ET créditté pour que l'envoi
 * aboutisse ; sans clé configurée, l'envoi est simplement ignoré (le SMS est
 * un « plus », il ne doit jamais bloquer le passage d'une commande en « prête »).
 */

const SMSPARTNER_ENDPOINT = "https://api.smspartner.fr/v1/send";

/**
 * Normalise un numéro FR au format attendu par les passerelles SMS :
 * indicatif pays sans « + » ni « 00 », sans espaces ni séparateurs.
 *   « 06 12 34 56 78 »   → « 33612345678 »
 *   « +33 6 12 34 56 78 »→ « 33612345678 »
 *   « 0033612345678 »    → « 33612345678 »
 * Renvoie `null` si le numéro ne ressemble pas à un mobile FR valide : on
 * préfère ne rien envoyer plutôt qu'un SMS à un numéro erroné (qui serait
 * facturé pour rien).
 */
export function normalizeFrMobile(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Ne garder que les chiffres, en mémorisant un éventuel « + » initial.
  const hasPlus = raw.trim().startsWith("+");
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // Préfixe international : « 00 » puis indicatif, ou « + » déjà retiré.
  if (digits.startsWith("0033")) digits = digits.slice(2); // 0033… → 33…
  else if (hasPlus && digits.startsWith("33")) {
    /* déjà 33… */
  } else if (digits.startsWith("0") && digits.length === 10) {
    // Numéro national 0X******** → 33X********
    digits = "33" + digits.slice(1);
  }

  // À ce stade on veut « 33 » + 9 chiffres, le 1er étant 6 ou 7 (mobile FR).
  if (!/^33[67]\d{8}$/.test(digits)) return null;
  return digits;
}

/**
 * Envoie un SMS. Best effort : ne jette jamais, renvoie un résultat structuré.
 * Sans `SMSPARTNER_API_KEY`, renvoie `{ ok:false, reason:"disabled" }` sans
 * appel réseau — la fonctionnalité est simplement inactive tant que la clé
 * n'est pas configurée sur l'environnement.
 */
export async function sendSms(opts: {
  to: string;
  text: string;
  sender?: string;
}): Promise<{ ok: boolean; reason: string }> {
  const apiKey = process.env.SMSPARTNER_API_KEY;
  if (!apiKey) return { ok: false, reason: "disabled" };

  const phone = normalizeFrMobile(opts.to);
  if (!phone) return { ok: false, reason: "bad_number" };

  // Nom d'expéditeur : 3–11 caractères alphanumériques (contrainte opérateurs).
  const sender = (opts.sender || process.env.SMS_SENDER || "Kado")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 11);

  try {
    const res = await fetch(`${SMSPARTNER_ENDPOINT}?apiKey=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phoneNumbers: phone,
        message: opts.text,
        ...(sender.length >= 3 ? { sender } : {}),
      }),
    });
    if (!res.ok) {
      reportError(new Error(`sms http ${res.status}`), { where: "sendSms" });
      return { ok: false, reason: `http_${res.status}` };
    }
    // SMSPartner renvoie { success: true } ou { success: false, message }.
    const data = (await res.json().catch(() => null)) as
      | { success?: boolean; message?: string }
      | null;
    if (data && data.success === false) {
      reportError(new Error(`sms api: ${data.message ?? "?"}`), { where: "sendSms" });
      return { ok: false, reason: "api_error" };
    }
    return { ok: true, reason: "sent" };
  } catch (e) {
    reportError(e, { where: "sendSms" });
    return { ok: false, reason: "network" };
  }
}
