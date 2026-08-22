"use client";

import { useEffect, useMemo, useState } from "react";

type Product = {
  id: string;
  name: string;
  price_cents: number;
  image_url?: string | null;
  description?: string | null;
};

function euros(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Convertit la clé VAPID publique au format attendu par le navigateur. */
function vapidKey(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * Abonne CET appareil aux notifications, pour être prévenu quand la commande
 * est prête. Renvoie l'abonnement (endpoint + clés) ou null si indisponible
 * (refus, iPhone non installé en app, clés VAPID absentes…). Ne lève jamais.
 */
async function subscribeForReady(): Promise<
  { endpoint: string; keys: { p256dh?: string; auth?: string } } | null
> {
  try {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    )
      return null;
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
    if (Notification.permission !== "granted") return null;
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const res = await fetch("/api/push");
    const { key } = await res.json();
    if (!key) return null;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey(key),
      }));
    const json = sub.toJSON();
    if (!json.endpoint) return null;
    return { endpoint: json.endpoint, keys: json.keys ?? {} };
  } catch {
    return null;
  }
}

const PICKUP_CHOICES = [
  "Dès que possible",
  "Dans 30 minutes",
  "Dans 1 heure",
  "Ce midi",
  "Ce soir",
];

export default function OrderClient({
  slug,
  name,
  logoUrl,
  products,
  open = true,
  nextOpen = null,
}: {
  slug: string;
  name: string;
  logoUrl: string | null;
  products: Product[];
  open?: boolean;
  nextOpen?: string | null;
}) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [checkout, setCheckout] = useState(false);
  const [cName, setCName] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [pickup, setPickup] = useState(PICKUP_CHOICES[0]);
  const [note, setNote] = useState("");
  const [notifyReady, setNotifyReady] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ code: string; total: number } | null>(
    null
  );

  const total = useMemo(
    () =>
      products.reduce((sum, p) => sum + (qty[p.id] ?? 0) * p.price_cents, 0),
    [qty, products]
  );
  const count = useMemo(
    () => Object.values(qty).reduce((a, b) => a + b, 0),
    [qty]
  );
  const cartLines = products.filter((p) => (qty[p.id] ?? 0) > 0);

  // Génère le QR du code de retrait (scannable par le commerçant)
  useEffect(() => {
    let alive = true;
    if (done) {
      import("qrcode")
        .then(({ default: QRCode }) =>
          QRCode.toDataURL(done.code, { width: 240, margin: 1 })
        )
        .then((url) => {
          if (alive) setQrUrl(url);
        })
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [done]);

  function bump(id: string, delta: number) {
    setQty((q) => {
      const next = Math.max(0, Math.min(20, (q[id] ?? 0) + delta));
      return { ...q, [id]: next };
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (count === 0) return;
    setBusy(true);
    try {
      // Opt-in « prévenez-moi » : on tente d'abonner l'appareil (demande
      // l'autorisation au navigateur). Sans blocage si refus/indisponible.
      const push = notifyReady ? await subscribeForReady() : null;
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          name: cName,
          phone: cPhone,
          pickup,
          note,
          email: cEmail,
          push,
          items: Object.entries(qty)
            .filter(([, n]) => n > 0)
            .map(([id, n]) => ({ id, qty: n })),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setDone({ code: d.code, total: d.total_cents });
        setCheckout(false);
      } else if (res.status === 429) {
        setErr("Trop de tentatives — patientez une minute puis réessayez.");
      } else if (d.error === "closed") {
        setErr(
          `Le commerce n'accepte pas de commande en ce moment${
            d.next ? ` — réouverture ${d.next}` : ""
          }.`
        );
      } else if (d.error === "product_unavailable") {
        setErr(
          "Un article de votre panier n'est plus disponible. Actualisez la page."
        );
      } else {
        setErr("Impossible d'envoyer la commande. Vérifiez vos informations.");
      }
    } catch {
      setErr("Connexion impossible. Vérifiez votre réseau.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="uber">
        <div className="uber-done">
          <div className="uber-done-emoji">🎉</div>
          <h1>Commande envoyée !</h1>
          <p>
            <b>{name}</b> prépare votre commande. Présentez ce code au retrait :
          </p>
          <div className="uber-done-code">{done.code}</div>
          {qrUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrUrl} alt="QR de retrait" className="uber-done-qr" />
          )}
          <p className="uber-done-total">
            Total à régler sur place : <b>{euros(done.total)} €</b>
          </p>
          <p className="uber-fine">
            💡 Le commerçant scanne ce QR (ou tape le code) au retrait.
            {cEmail.trim()
              ? " Votre bon de commande vient de vous être envoyé par e-mail."
              : " Faites une capture d'écran pour le garder sous la main."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="uber">
      {/* ---- En-tête commerce ---- */}
      <header className="uber-head">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={name} className="uber-logo" />
        ) : (
          <div className="uber-logo uber-logo-empty">🛍️</div>
        )}
        <div>
          <h1>{name}</h1>
          <div className="uber-tags">
            <span className="uber-tag">🛒 Click &amp; collect</span>
            <span className="uber-tag">💶 Paiement sur place</span>
          </div>
        </div>
      </header>

      {/* ---- Bannière fermé ---- */}
      {!open && (
        <div className="uber-closed">
          😴 <b>Fermé pour le moment</b>
          {nextOpen ? ` — les commandes rouvrent ${nextOpen}.` : "."}
          {" "}Vous pouvez consulter le menu en attendant.
        </div>
      )}

      {/* ---- Catalogue ---- */}
      <section className="uber-menu">
        {products.map((p) => {
          const n = qty[p.id] ?? 0;
          return (
            <article key={p.id} className={`uber-item${n > 0 ? " in-cart" : ""}`}>
              <div className="uber-item-info">
                <h3>{p.name}</h3>
                {p.description && <p>{p.description}</p>}
                <span className="uber-price">{euros(p.price_cents)} €</span>
              </div>
              <div className="uber-item-media">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt={p.name} loading="lazy" />
                ) : (
                  <div className="uber-noimg">🍽️</div>
                )}
                {n === 0 ? (
                  <button
                    type="button"
                    className="uber-add"
                    aria-label={`Ajouter ${p.name}`}
                    onClick={() => bump(p.id, 1)}
                  >
                    +
                  </button>
                ) : (
                  <div className="uber-stepper">
                    <button
                      type="button"
                      aria-label="Retirer"
                      onClick={() => bump(p.id, -1)}
                    >
                      −
                    </button>
                    <span>{n}</span>
                    <button
                      type="button"
                      aria-label="Ajouter"
                      onClick={() => bump(p.id, 1)}
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <p className="uber-fine">
        Aucun paiement en ligne : vous réglez au comptoir lors du retrait.
      </p>

      {/* ---- Barre panier collante ---- */}
      {count > 0 && !checkout && open && (
        <button className="uber-cartbar" onClick={() => setCheckout(true)}>
          <span className="uber-cartbar-count">{count}</span>
          Voir le panier
          <span className="uber-cartbar-total">{euros(total)} €</span>
        </button>
      )}

      {/* ---- Fiche de finalisation (façon bottom sheet) ---- */}
      {checkout && (
        <div className="uber-sheet-wrap" onClick={() => !busy && setCheckout(false)}>
          <div className="uber-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="uber-sheet-bar" />
            <h2>Votre commande</h2>
            <ul className="uber-recap">
              {cartLines.map((p) => (
                <li key={p.id}>
                  <div className="uber-stepper small">
                    <button
                      type="button"
                      aria-label={`Retirer un ${p.name}`}
                      onClick={() => bump(p.id, -1)}
                    >
                      −
                    </button>
                    <span>{qty[p.id]}</span>
                    <button
                      type="button"
                      aria-label={`Ajouter un ${p.name}`}
                      onClick={() => bump(p.id, 1)}
                    >
                      +
                    </button>
                  </div>
                  <span className="uber-recap-name">{p.name}</span>
                  <span className="uber-recap-price">
                    {euros(p.price_cents * (qty[p.id] ?? 0))} €
                  </span>
                </li>
              ))}
            </ul>
            <div className="uber-recap-total">
              <span>Total (à payer sur place)</span>
              <b>{euros(total)} €</b>
            </div>

            <form onSubmit={submit} className="uber-form">
              <input
                type="text"
                required
                placeholder="Votre prénom et nom"
                value={cName}
                onChange={(e) => setCName(e.target.value)}
              />
              <input
                type="tel"
                required
                placeholder="Votre téléphone (ex. 06 12 34 56 78)"
                value={cPhone}
                onChange={(e) => setCPhone(e.target.value)}
              />
              <input
                type="email"
                placeholder="E-mail (facultatif — pour recevoir votre bon de commande)"
                value={cEmail}
                onChange={(e) => setCEmail(e.target.value)}
              />
              <select value={pickup} onChange={(e) => setPickup(e.target.value)}>
                {PICKUP_CHOICES.map((c) => (
                  <option key={c} value={c}>
                    🕒 {c}
                  </option>
                ))}
              </select>
              <textarea
                placeholder="Une précision ? (facultatif — ex. sans oignons)"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <label className="uber-notify">
                <input
                  type="checkbox"
                  checked={notifyReady}
                  onChange={(e) => setNotifyReady(e.target.checked)}
                />
                <span>
                  🔔 Prévenez-moi quand ma commande est <b>prête</b>
                  <small>
                    Notification sur cet appareil{cEmail ? " + e-mail" : ""} —
                    plus besoin de bipeur.
                  </small>
                </span>
              </label>
              {err && <p className="uber-err">{err}</p>}
              <button className="uber-submit" disabled={busy || count === 0}>
                {busy ? "Envoi…" : `Commander — ${euros(total)} €`}
              </button>
              <p className="uber-fine">
                En commandant, vous acceptez d'être contacté par le commerce au
                sujet de votre commande.
              </p>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
