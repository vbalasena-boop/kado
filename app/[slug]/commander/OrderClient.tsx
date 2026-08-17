"use client";

import { useMemo, useState } from "react";

type Product = { id: string; name: string; price_cents: number };

function euros(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
}: {
  slug: string;
  name: string;
  logoUrl: string | null;
  products: Product[];
}) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [cName, setCName] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [pickup, setPickup] = useState(PICKUP_CHOICES[0]);
  const [note, setNote] = useState("");
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

  function bump(id: string, delta: number) {
    setQty((q) => {
      const next = Math.max(0, Math.min(20, (q[id] ?? 0) + delta));
      return { ...q, [id]: next };
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (count === 0) {
      setErr("Ajoutez au moins un article à votre commande.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          name: cName,
          phone: cPhone,
          pickup,
          note,
          items: Object.entries(qty)
            .filter(([, n]) => n > 0)
            .map(([id, n]) => ({ id, qty: n })),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setDone({ code: d.code, total: d.total_cents });
      } else if (res.status === 429) {
        setErr("Trop de tentatives — patientez une minute puis réessayez.");
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
      <main className="landing order-page">
        <div className="landing-card order-done">
          <div className="landing-logo">🎉</div>
          <h1>Commande envoyée !</h1>
          <p>
            <b>{name}</b> prépare votre commande. Présentez ce code au retrait :
          </p>
          <div className="order-done-code">{done.code}</div>
          <p className="order-done-total">
            Total à régler sur place : <b>{euros(done.total)} €</b>
          </p>
          <p className="fine">
            💡 Notez ce code ou faites une capture d'écran — il vous sera
            demandé au comptoir.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="landing order-page">
      <div className="landing-card order-card-page">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={name} className="order-logo" />
        ) : (
          <div className="landing-logo">🛒</div>
        )}
        <h1>{name}</h1>
        <p className="order-sub">
          Commandez, on prépare — <b>vous payez sur place</b> au retrait.
        </p>

        <ul className="order-products">
          {products.map((p) => (
            <li key={p.id}>
              <div className="order-p-info">
                <b>{p.name}</b>
                <span>{euros(p.price_cents)} €</span>
              </div>
              <div className="order-qty">
                <button
                  type="button"
                  aria-label="Retirer"
                  onClick={() => bump(p.id, -1)}
                  disabled={(qty[p.id] ?? 0) === 0}
                >
                  −
                </button>
                <span>{qty[p.id] ?? 0}</span>
                <button
                  type="button"
                  aria-label="Ajouter"
                  onClick={() => bump(p.id, 1)}
                >
                  +
                </button>
              </div>
            </li>
          ))}
        </ul>

        <form onSubmit={submit} className="order-form">
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

          {err && <p className="order-err">{err}</p>}

          <button className="btn order-submit" disabled={busy || count === 0}>
            {busy
              ? "Envoi…"
              : count === 0
              ? "Choisissez vos articles"
              : `Commander — ${euros(total)} € (à payer sur place)`}
          </button>
          <p className="fine">
            Aucun paiement en ligne : vous réglez au comptoir lors du retrait.
          </p>
        </form>
      </div>
    </main>
  );
}
