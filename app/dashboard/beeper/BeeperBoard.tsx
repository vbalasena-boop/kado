"use client";
import { useEffect, useState } from "react";
import { BEEPER_LABELS, type BeeperOrder } from "@/lib/beeper";
export default function BeeperBoard() {
  const [orders, setOrders] = useState<BeeperOrder[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const r = await fetch("/api/beeper/merchant", { cache: "no-store" });
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        if (!stopped) { setOrders(body.orders); setError(""); }
      } catch { if (!stopped) setError("Actualisation impossible. Réessayez dans un instant."); }
      if (!stopped) timer = setTimeout(refresh, 5000);
    }
    void refresh();
    return () => { stopped = true; clearTimeout(timer); };
  }, []);
  async function change(order: BeeperOrder) {
    setBusy(order.id);
    try {
      const r = await fetch("/api/beeper/merchant", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: order.id, status: order.status === "preparing" ? "ready" : "collected" }) });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      setOrders(rows => rows.flatMap(row => row.id !== order.id ? [row] : body.order.status === "collected" ? [] : [body.order]));
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Modification impossible."); }
    finally { setBusy(null); }
  }
  return <div className="dash-card"><h2>Numéros actifs</h2>{error && <p role="alert">{error}</p>}
    {!orders.length && <p>Aucun beeper actif.</p>}
    {orders.map(order => <div key={order.id} style={{ display: "flex", gap: 16, padding: 12, alignItems: "center" }}><strong>N° {order.number}</strong><span>{BEEPER_LABELS[order.status]}</span><button className="btn-mini" disabled={busy !== null} onClick={() => change(order)}>{order.status === "preparing" ? "Prête" : "Récupérée"}</button></div>)}
  </div>;
}
