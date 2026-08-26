"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { subscribeWithCurrentKey } from "@/lib/push-client";

/** Bipeur intégré : son + vibration quand la commande passe « prête ». */
function playReadyBuzz(ctx: AudioContext | null) {
  try {
    (navigator as any).vibrate?.([200, 100, 200, 100, 500]);
  } catch {
    /* iOS : pas de vibration */
  }
  if (!ctx) return;
  try {
    ctx.resume?.();
    [0, 500, 1000].forEach((delay) => {
      const t0 = ctx.currentTime + delay / 1000;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, t0);
      osc.frequency.setValueAtTime(1175, t0 + 0.18);
      g.gain.setValueAtTime(0.001, t0);
      g.gain.exponentialRampToValueAtTime(0.4, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.36);
      osc.connect(g).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.38);
    });
  } catch {
    /* audio bloqué */
  }
}

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
    const sub = await subscribeWithCurrentKey(reg, key);
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
  payOnline = false,
}: {
  slug: string;
  name: string;
  logoUrl: string | null;
  products: Product[];
  open?: boolean;
  nextOpen?: string | null;
  payOnline?: boolean;
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
  const [mode, setMode] = useState<"emporter" | "sur_place">("emporter");
  const [table, setTable] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ code: string; total: number } | null>(
    null
  );
  const [status, setStatus] = useState<string>("new");
  const [buzzing, setBuzzing] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const lastStatusRef = useRef("new");
  const buzzedRef = useRef(false);

  // Débloque l'audio dès la 1re interaction (iOS l'exige).
  useEffect(() => {
    function unlock() {
      if (!audioRef.current) {
        try {
          const Ctx =
            (window as any).AudioContext || (window as any).webkitAudioContext;
          if (Ctx) audioRef.current = new Ctx();
        } catch {
          /* audio indisponible */
        }
      }
      audioRef.current?.resume?.();
    }
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

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

  // Suivi en direct : on interroge le statut de la commande tant que le client
  // reste sur l'écran de confirmation (jusqu'à « prête »/« retirée »/« annulée »).
  useEffect(() => {
    if (!done?.code) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const r = await fetch(
          `/api/order/status?slug=${encodeURIComponent(
            slug
          )}&code=${encodeURIComponent(done!.code)}`
        );
        const d = await r.json().catch(() => ({}));
        if (alive && d?.status) {
          if (
            d.status === "ready" &&
            lastStatusRef.current !== "ready" &&
            !buzzedRef.current
          ) {
            buzzedRef.current = true;
            playReadyBuzz(audioRef.current);
            setBuzzing(true);
            try {
              document.title = "✅ C'est prêt !";
            } catch {
              /* ignore */
            }
            setTimeout(() => setBuzzing(false), 8000);
          }
          lastStatusRef.current = d.status;
          setStatus(d.status);
        }
        if (alive && !["ready", "done", "cancelled"].includes(d?.status)) {
          timer = setTimeout(poll, 12000);
        }
      } catch {
        if (alive) timer = setTimeout(poll, 20000);
      }
    }
    timer = setTimeout(poll, 6000);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [done, slug]);

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
          mode,
          table,
          items: Object.entries(qty)
            .filter(([, n]) => n > 0)
            .map(([id, n]) => ({ id, qty: n })),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.checkoutUrl) {
        // Paiement en ligne : redirection vers la page sécurisée Stripe.
        window.location.href = d.checkoutUrl;
        return;
      } else if (res.ok) {
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
    const cancelled = status === "cancelled";
    // 0 Reçue · 1 En préparation · 2 Prête · 3 Retirée
    const reached =
      status === "done" ? 3 : status === "ready" ? 2 : 1;
    const onsite = mode === "sur_place";
    const TRACK = [
      "Reçue",
      "En préparation",
      "Prête",
      onsite ? "Servie" : "Retirée",
    ];
    const bannerEmoji = cancelled
      ? "❌"
      : status === "ready"
      ? "✅"
      : status === "done"
      ? "🙌"
      : "👨‍🍳";
    const bannerText = cancelled
      ? "Commande annulée"
      : status === "ready"
      ? "Votre commande est prête !"
      : status === "done"
      ? "Commande retirée — merci !"
      : "En préparation…";
    return (
      <main className="uber">
        {buzzing && (
          <div className="buzz-flash" aria-hidden="true">
            <div className="buzz-flash-in">✅ C'est prêt !</div>
          </div>
        )}
        <div className="uber-done">
          <div className="uber-done-emoji">{status === "ready" ? "✅" : "🎉"}</div>
          <h1>Commande envoyée !</h1>

          {/* Suivi en direct */}
          <div className={`track-banner${status === "ready" ? " ready" : ""}${cancelled ? " cancelled" : ""}`}>
            <span className="track-banner-emoji">{bannerEmoji}</span>
            <b>{bannerText}</b>
          </div>
          {!cancelled && (
            <ol className="track">
              {TRACK.map((label, i) => (
                <li
                  key={label}
                  className={
                    i < reached ? "done" : i === reached ? "active" : "todo"
                  }
                >
                  <span className="track-dot">{i < reached ? "✓" : i + 1}</span>
                  <span className="track-label">{label}</span>
                </li>
              ))}
            </ol>
          )}

          {onsite && table.trim() && !cancelled && (
            <div className="track-table">🍽️ Table {table.trim()}</div>
          )}
          <p>
            {status === "ready"
              ? onsite
                ? "C'est prêt ! Présentez ce code au comptoir :"
                : "Venez la récupérer ! Présentez ce code :"
              : status === "done"
              ? "Merci et à bientôt !"
              : cancelled
              ? "Contactez le commerce pour plus d'informations."
              : onsite
              ? <><b>{name}</b> prépare votre commande — <b>restez à votre place</b>, on vous prévient dès que c'est prêt.</>
              : <><b>{name}</b> prépare votre commande. Présentez ce code au retrait :</>}
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
            💡 Le commerçant scanne ce QR (ou tape le code) au retrait.{" "}
            <b>Gardez cette page ouverte</b> pour suivre votre commande en
            direct.
            {notifyReady
              ? " Vous serez aussi prévenu dès que c'est prêt."
              : cEmail.trim()
              ? " Votre bon de commande vient de vous être envoyé par e-mail."
              : " Ou faites une capture d'écran pour garder votre code."}
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
                  <img
                    src={p.image_url}
                    alt={p.name}
                    loading="lazy"
                    decoding="async"
                  />
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
              <div className="uber-mode" role="group" aria-label="Mode de service">
                <button
                  type="button"
                  className={mode === "sur_place" ? "on" : ""}
                  onClick={() => setMode("sur_place")}
                >
                  🍽️ Sur place
                </button>
                <button
                  type="button"
                  className={mode === "emporter" ? "on" : ""}
                  onClick={() => setMode("emporter")}
                >
                  🥡 À emporter
                </button>
              </div>
              {mode === "sur_place" && (
                <input
                  type="text"
                  inputMode="text"
                  placeholder="Numéro de table (facultatif — ex. 5)"
                  value={table}
                  onChange={(e) => setTable(e.target.value)}
                />
              )}
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
              {mode === "emporter" && (
                <select
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                >
                  {PICKUP_CHOICES.map((c) => (
                    <option key={c} value={c}>
                      🕒 {c}
                    </option>
                  ))}
                </select>
              )}
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
                {busy
                  ? "Envoi…"
                  : payOnline
                  ? `Payer ${euros(total)} € →`
                  : `Commander — ${euros(total)} €`}
              </button>
              <p className="uber-fine">
                {payOnline
                  ? "Paiement 100 % sécurisé par Stripe. Vous récupérez votre commande sur place."
                  : "En commandant, vous acceptez d'être contacté par le commerce au sujet de votre commande."}
              </p>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
