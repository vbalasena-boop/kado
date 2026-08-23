/**
 * Abonnement Web Push côté navigateur, robuste au changement de clé VAPID.
 *
 * Problème résolu : `pushManager.getSubscription()` renvoie l'abonnement
 * existant même s'il a été créé avec une ANCIENNE clé VAPID. On l'envoie alors
 * au serveur qui, avec sa nouvelle clé privée, se fait rejeter (HTTP 403) par
 * le service de push. Ici on compare la clé de l'abonnement existant à la clé
 * courante et, si elle diffère, on se désabonne puis on se réabonne.
 */

/** Convertit la clé publique VAPID (base64url) au format attendu par le navigateur. */
export function vapidKeyToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * Renvoie un abonnement push valide pour la clé publique fournie, en recréant
 * l'abonnement si sa clé a changé depuis la dernière fois.
 */
export async function subscribeWithCurrentKey(
  reg: ServiceWorkerRegistration,
  keyBase64: string
): Promise<PushSubscription> {
  const appKey = vapidKeyToBytes(keyBase64);
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    const raw = existing.options.applicationServerKey;
    const cur = raw ? new Uint8Array(raw as ArrayBuffer) : new Uint8Array(0);
    const same =
      cur.length === appKey.length && cur.every((b, i) => b === appKey[i]);
    if (same) return existing;
    // Clé différente (rotation VAPID) : on repart d'un abonnement neuf.
    try {
      await existing.unsubscribe();
    } catch {
      /* ignore */
    }
  }
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: appKey,
  });
}
