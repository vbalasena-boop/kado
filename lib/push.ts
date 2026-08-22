import type { SupabaseClient } from "@supabase/supabase-js";

type PushPayload = { title: string; body: string; url?: string };

/**
 * Envoie une notification Web Push à une liste d'abonnements et nettoie
 * ceux qui ont expiré. Nécessite VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY
 * (sinon : ignoré sans bruit).
 */
async function sendToTable(
  db: SupabaseClient,
  table: "push_subscriptions" | "client_push_subscriptions",
  businessId: string,
  payload: PushPayload
): Promise<number> {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return 0;

  let subs: { id: string; endpoint: string; p256dh: string; auth: string }[];
  try {
    const { data } = await db
      .from(table)
      .select("id, endpoint, p256dh, auth")
      .eq("business_id", businessId);
    subs = data ?? [];
  } catch {
    return 0; // table absente
  }
  if (subs.length === 0) return 0;

  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:contact@kado-app.fr",
    pub,
    priv
  );

  let sent = 0;
  const gone: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          JSON.stringify(payload),
          { TTL: 24 * 3600 }
        );
        sent++;
      } catch (e: any) {
        // abonnement expiré/révoqué : on le supprime
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          gone.push(s.id);
        }
      }
    })
  );
  if (gone.length > 0) {
    try {
      await db.from(table).delete().in("id", gone);
    } catch {
      /* ignore */
    }
  }
  return sent;
}

/**
 * Push vers UN abonnement précis (ex. le client d'une commande donnée).
 * `sub` = { endpoint, p256dh, auth }. Renvoie true si envoyé, false sinon
 * (clés VAPID absentes, abonnement invalide ou expiré). Ne lève jamais.
 */
export async function sendPushToSubscription(
  sub: { endpoint?: string; p256dh?: string; auth?: string } | null | undefined,
  payload: PushPayload
): Promise<boolean> {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!sub?.endpoint || !sub.p256dh || !sub.auth) return false;

  try {
    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:contact@kado-app.fr",
      pub,
      priv
    );
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 24 * 3600 }
    );
    return true;
  } catch {
    return false;
  }
}

/** Push vers les appareils du COMMERÇANT (alertes de commandes). */
export function sendPushToBusiness(
  db: SupabaseClient,
  businessId: string,
  payload: PushPayload
) {
  return sendToTable(db, "push_subscriptions", businessId, payload);
}

/** Push vers les CLIENTS abonnés aux offres du commerce (campagnes). */
export function sendPushToClients(
  db: SupabaseClient,
  businessId: string,
  payload: PushPayload
) {
  return sendToTable(db, "client_push_subscriptions", businessId, payload);
}
