"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";

export type Product = {
  id: string;
  name: string;
  price_cents: number;
  active: boolean;
};

export type Order = {
  id: string;
  code: string;
  customer_name: string;
  customer_phone: string;
  pickup_at: string | null;
  note: string | null;
  items: { name: string; qty: number; price_cents: number }[];
  total_cents: number;
  status: string;
  created_at: string;
};

function euros(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtTime(s: string) {
  return new Date(s).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OrdersClient({
  slug,
  products,
  orders,
}: {
  slug: string;
  products: Product[];
  orders: Order[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pName, setPName] = useState("");
  const [pPrice, setPPrice] = useState("");

  // Rafraîchit la liste toutes les 60 s pour voir arriver les commandes
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 60000);
    return () => clearInterval(t);
  }, [router]);

  async function productAction(payload: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/dashboard/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setMsg("❌ " + (d.detail || d.error || "Échec."));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!pName.trim() || !pPrice.trim()) return;
    await productAction({ action: "create", name: pName, price: pPrice });
    setPName("");
    setPPrice("");
  }

  async function setStatus(id: string, status: string) {
    setBusy(true);
    try {
      await fetch("/api/dashboard/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const fresh = orders.filter((o) => o.status === "new");
  const ready = orders.filter((o) => o.status === "ready");
  const past = orders.filter((o) => o.status === "done" || o.status === "cancelled");

  function OrderCard({ o }: { o: Order }) {
    return (
      <li className={`order-card is-${o.status}`}>
        <div className="order-head">
          <span className="order-code">{o.code}</span>
          <b>{o.customer_name}</b>
          <a href={`tel:${o.customer_phone.replace(/\s/g, "")}`}>
            📞 {o.customer_phone}
          </a>
          <span className="order-time">{fmtTime(o.created_at)}</span>
        </div>
        <div className="order-body">
          <span>
            🕒 Retrait : <b>{o.pickup_at || "dès que possible"}</b>
          </span>
          {o.note && <span>📝 {o.note}</span>}
          <ul className="order-items">
            {o.items.map((l, i) => (
              <li key={i}>
                {l.qty} × {l.name}
                <span>{euros(l.price_cents * l.qty)} €</span>
              </li>
            ))}
          </ul>
          <div className="order-total">
            Total à encaisser : <b>{euros(o.total_cents)} €</b>
          </div>
        </div>
        {(o.status === "new" || o.status === "ready") && (
          <div className="order-actions">
            {o.status === "new" && (
              <button
                className="btn-mini ok"
                disabled={busy}
                onClick={() => setStatus(o.id, "ready")}
              >
                <Icon name="check" size={15} /> Prête
              </button>
            )}
            {o.status === "ready" && (
              <button
                className="btn-mini ok"
                disabled={busy}
                onClick={() => setStatus(o.id, "done")}
              >
                <Icon name="check" size={15} /> Retirée &amp; payée
              </button>
            )}
            <button
              className="btn-mini danger"
              disabled={busy}
              onClick={() => {
                if (confirm(`Annuler la commande ${o.code} ?`))
                  setStatus(o.id, "cancelled");
              }}
            >
              Annuler
            </button>
          </div>
        )}
      </li>
    );
  }

  return (
    <>
      <h1 className="dash-h1">Commandes — Click &amp; collect</h1>
      <p className="dash-sub">
        Vos clients commandent sur{" "}
        <a href={`/${slug}/commander`} target="_blank" className="admin-slug">
          kado-app.fr/{slug}/commander ↗
        </a>{" "}
        et <b>paient sur place</b> au retrait. Vous recevez un e-mail à chaque
        commande.
      </p>

      {msg && <p className="save-msg is-err">{msg}</p>}

      {/* ---- Commandes en cours ---- */}
      <div className="dash-card">
        <h2>
          🔔 À préparer{" "}
          {fresh.length > 0 && (
            <span className="setup-badge-todo">{fresh.length}</span>
          )}
        </h2>
        {fresh.length === 0 ? (
          <p className="muted">Aucune nouvelle commande pour l'instant.</p>
        ) : (
          <ul className="order-list">
            {fresh.map((o) => (
              <OrderCard key={o.id} o={o} />
            ))}
          </ul>
        )}

        {ready.length > 0 && (
          <>
            <h2 style={{ marginTop: 18 }}>✅ Prêtes — en attente de retrait</h2>
            <ul className="order-list">
              {ready.map((o) => (
                <OrderCard key={o.id} o={o} />
              ))}
            </ul>
          </>
        )}

        {past.length > 0 && (
          <details className="setup-history">
            <summary>
              📦 Historique — {past.length} commande{past.length > 1 ? "s" : ""}
            </summary>
            <ul className="order-list">
              {past.map((o) => (
                <li key={o.id} className={`order-card is-${o.status} muted-card`}>
                  <div className="order-head">
                    <span className="order-code">{o.code}</span>
                    <b>{o.customer_name}</b>
                    <span>{euros(o.total_cents)} €</span>
                    <span className="order-time">
                      {o.status === "cancelled" ? "✖ annulée" : "✔ retirée"} ·{" "}
                      {fmtTime(o.created_at)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* ---- Catalogue ---- */}
      <div className="dash-card">
        <h2>🧺 Mon catalogue</h2>
        <p className="muted">
          Les produits affichés sur votre page de commande. Masquez un produit
          en rupture plutôt que de le supprimer.
        </p>
        <form onSubmit={addProduct} className="admin-create" style={{ marginTop: 12 }}>
          <input
            type="text"
            required
            placeholder="Nom du produit (ex. Formule sandwich + boisson)"
            value={pName}
            onChange={(e) => setPName(e.target.value)}
          />
          <input
            type="text"
            required
            inputMode="decimal"
            placeholder="Prix en € (ex. 8,50)"
            style={{ maxWidth: 140 }}
            value={pPrice}
            onChange={(e) => setPPrice(e.target.value)}
          />
          <button className="btn" disabled={busy}>
            <Icon name="add" size={18} /> Ajouter
          </button>
        </form>

        {products.length > 0 && (
          <ul className="product-list">
            {products.map((p) => (
              <li key={p.id} className={p.active ? "" : "is-off"}>
                <b>{p.name}</b>
                <span className="product-price">{euros(p.price_cents)} €</span>
                <div className="product-actions">
                  <button
                    className="btn-mini soft"
                    disabled={busy}
                    onClick={() => productAction({ action: "toggle", id: p.id })}
                  >
                    {p.active ? "Masquer" : "Afficher"}
                  </button>
                  <button
                    className="btn-mini danger"
                    disabled={busy}
                    onClick={() => {
                      if (confirm(`Supprimer « ${p.name} » ?`))
                        productAction({ action: "delete", id: p.id });
                    }}
                  >
                    <Icon name="delete" size={15} /> Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
