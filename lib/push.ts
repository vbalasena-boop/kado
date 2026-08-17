import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Envoi de notifications Web Push aux appareils abonnés d'un commerce.
 * Nécessite VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY (sinon : ignoré sans bruit).
 */
export async function sendPushToBusiness(
  db: SupabaseClient,
  businessId: string,
  payload: { title: string; body: string; url?: string }
): Promise<number> {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return 0;

  let subs: { id: string; endpoint: string; p256dh: string; auth: string }[];
  try {
    const { data } = await db
      .from("push_subscriptions")
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
          { TTL: 3600 }
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
      await db.from("push_subscriptions").delete().in("id", gone);
    } catch {
      /* ignore */
    }
  }
  return sent;
}
