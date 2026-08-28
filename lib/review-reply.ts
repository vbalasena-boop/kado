/**
 * Assistant de réponse aux avis Google — logique PURE (gabarits, sans IA).
 *
 * Le commerçant choisit le type d'avis et un ton ; on assemble un brouillon
 * de réponse courtoise en français, qu'il personnalise avant de le publier.
 * On NE prétend PAS analyser le texte de l'avis (honnêteté) : il sert de
 * référence à l'écran, il n'est pas interprété ici.
 */

export type ReviewReplyKind = "negatif" | "mitige" | "positif";
export type ReviewReplyTone = "sobre" | "chaleureux";

export type ReviewReplyInput = {
  shopName?: string | null;
  kind: ReviewReplyKind;
  tone?: ReviewReplyTone;
  authorName?: string | null;
};

/** Nettoie un prénom saisi (pas de balises, borné). */
function cleanName(n?: string | null): string {
  if (!n) return "";
  return n.replace(/[<>]/g, "").trim().slice(0, 40);
}

/**
 * Brouillon de réponse (texte brut, multi-paragraphes). Jamais d'exception :
 * `shopName` vide → signature de repli ; `authorName` vide → salutation
 * générique ; `kind` inconnu → traité comme « mitige ».
 */
export function draftReviewReply(input: ReviewReplyInput): string {
  const tone: ReviewReplyTone =
    input.tone === "chaleureux" ? "chaleureux" : "sobre";
  const name = cleanName(input.authorName);
  const shop = (input.shopName || "").trim();
  const greeting = name ? `Bonjour ${name},` : "Bonjour,";
  const sign = shop ? `L'équipe de ${shop}` : "L'équipe";
  const closing = tone === "chaleureux" ? "Bien chaleureusement," : "Bien à vous,";

  let body: string;
  if (input.kind === "negatif") {
    body =
      tone === "chaleureux"
        ? "Merci d'avoir pris le temps de nous écrire, et sincèrement désolés que votre expérience n'ait pas été à la hauteur — ce n'est vraiment pas ce que nous souhaitons pour vous. Nous aimerions beaucoup comprendre ce qui s'est passé et trouver une solution ensemble : n'hésitez pas à nous contacter directement, nous nous en occupons personnellement."
        : "Merci d'avoir pris le temps de partager votre retour, et navrés que votre expérience n'ait pas été à la hauteur. Nous aimerions comprendre ce qui s'est passé et trouver une solution : n'hésitez pas à nous contacter directement.";
  } else if (input.kind === "positif") {
    body =
      tone === "chaleureux"
        ? "Un grand merci pour ce gentil retour, cela nous fait chaud au cœur ! Toute l'équipe est ravie que vous ayez passé un bon moment. Nous avons hâte de vous revoir très bientôt."
        : "Merci beaucoup pour votre retour positif. Nous sommes ravis que vous ayez apprécié votre expérience et serons heureux de vous accueillir à nouveau.";
  } else {
    // « mitige » (et repli pour tout kind inattendu)
    body =
      tone === "chaleureux"
        ? "Merci beaucoup pour votre retour, il compte vraiment pour nous. Nous sommes ravis que certains points vous aient plu, et nous prenons note de ce qui peut être amélioré — c'est ainsi que nous progressons. Au plaisir de vous accueillir à nouveau !"
        : "Merci pour votre retour. Nous sommes contents que certains points vous aient satisfait, et nous prenons note de ce qui peut être amélioré. Au plaisir de vous revoir.";
  }

  return `${greeting}\n\n${body}\n\n${closing}\n${sign}`;
}
