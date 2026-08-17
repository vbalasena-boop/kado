"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";

export type Product = {
  id: string;
  name: string;
  price_cents: number;
  active: boolean;
  image_url?: string | null;
  description?: string | null;
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
  const [pDesc, setPDesc] = useState("");

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
    await productAction({
      action: "create",
      name: pName,
      price: pPrice,
      description: pDesc,
    });
    setPName("");
    setPPrice("");
    setPDesc("");
  }

  /** Upload de la photo d'un produit (déclenché par l'input fichier caché). */
  async function uploadImage(id: string, file: File) {
    setBusy(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append("id", id);
      form.append("file", file);
      const res = await fetch("/api/dashboard/products/image", {
        method: "POST",
        body: form,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(
          "❌ " +
            (d.error === "too_large"
              ? "Image trop lourde (4 Mo max)."
              : d.error === "not_an_image"
              ? "Le fichier doit être une image."
              : "Échec de l'envoi de la photo.")
        );
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
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
        <form onSubmit={addProduct} className="product-form">
          <div className="product-form-row">
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
          </div>
          <div className="product-form-row">
            <input
              type="text"
              placeholder="Description courte (facultatif — ex. Pain frais, jambon, crudités)"
              maxLength={200}
              value={pDesc}
              onChange={(e) => setPDesc(e.target.value)}
            />
            <button className="btn" disabled={busy}>
              <Icon name="add" size={18} /> Ajouter
            </button>
          </div>
          <p className="muted" style={{ fontSize: 12.5 }}>
            💡 Ajoutez ensuite une photo à chaque produit : les produits en
            photo se vendent beaucoup mieux.
          </p>
        </form>

        {products.length > 0 && (
          <ul className="product-list">
            {products.map((p) => (
              <li key={p.id} className={p.active ? "" : "is-off"}>
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt="" className="product-thumb" />
                ) : (
                  <span className="product-thumb product-thumb-empty">🍽️</span>
                )}
                <div className="product-info">
                  <b>{p.name}</b>
                  {p.description && <small>{p.description}</small>}
                </div>
                <span className="product-price">{euros(p.price_cents)} €</span>
                <div className="product-actions">
                  <label className={`btn-mini soft product-photo-btn${busy ? " is-disabled" : ""}`}>
                    📷 {p.image_url ? "Changer" : "Photo"}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      disabled={busy}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadImage(p.id, f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {p.image_url && (
                    <button
                      className="btn-mini soft"
                      disabled={busy}
                      onClick={() =>
                        productAction({ action: "remove_image", id: p.id })
                      }
                    >
                      Sans photo
                    </button>
                  )}
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
