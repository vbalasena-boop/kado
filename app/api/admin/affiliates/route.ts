import { NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin-guard";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Crée un vendeur (apporteur d'affaires) avec son code de lien. */
export async function POST(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: "forbidden" }, { status: 403 });

  let body: {
    name?: string;
    email?: string;
    code?: string;
    commission_roue?: number;
    commission_fidelite?: number;
    commission_complet?: number;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) return Response.json({ error: "name_required" }, { status: 400 });
  const email = (body.email || "").trim().toLowerCase() || null;

  // Code du lien : celui fourni, sinon dérivé du nom (paul-martin → paul-martin)
  const code = (body.code || name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 40);
  if (!code) return Response.json({ error: "code_required" }, { status: 400 });

  // Montants en euros → centimes (bornés 0..1000 €), défauts 30/20/45
  // (≈ 1er mois d'abonnement arrondi, versé après le 2e prélèvement).
  const cents = (v: unknown, dflt: number) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 1000) return dflt;
    return Math.round(n * 100);
  };

  const db = getAdminClient();
  const { data, error } = await db
    .from("affiliates")
    .insert({
      name,
      email,
      code,
      commission_roue_cents: cents(body.commission_roue, 3000),
      commission_fidelite_cents: cents(body.commission_fidelite, 2000),
      commission_complet_cents: cents(body.commission_complet, 4500),
    })
    .select("id, code")
    .single();

  if (error) {
    const dup = /duplicate|unique/i.test(error.message);
    return Response.json(
      { error: dup ? "code_taken" : "create_failed" },
      { status: dup ? 409 : 500 }
    );
  }
  return Response.json({ ok: true, id: data.id, code: data.code });
}

/** Active/désactive un vendeur, ou marque ses commissions comme payées. */
export async function PATCH(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: "forbidden" }, { status: 403 });

  let body: { id?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const id = (body.id || "").trim();
  if (!id) return Response.json({ error: "id_required" }, { status: 400 });

  const db = getAdminClient();

  // Commissions dues du vendeur, avec l'état d'abonnement du client :
  // exigible = client toujours actif ET 2e prélèvement passé (~30 jours).
  async function dueWithBizStatus(affiliateId: string) {
    const { data: comms } = await db
      .from("affiliate_commissions")
      .select("id, business_id, created_at")
      .eq("affiliate_id", affiliateId)
      .eq("status", "due");
    const list = comms ?? [];
    if (list.length === 0) return [];
    const { data: bizs } = await db
      .from("businesses")
      .select("id, subscription_status")
      .in("id", list.map((c) => c.business_id));
    const statusById = new Map(
      (bizs ?? []).map((b) => [b.id, b.subscription_status])
    );
    return list.map((c) => ({
      ...c,
      bizActive: ["active", "trial"].includes(
        statusById.get(c.business_id) ?? ""
      ),
    }));
  }
  const THIRTY_DAYS = 30 * 864e5;

  if (body.action === "mark_paid") {
    // Seules les commissions EXIGIBLES → payées (après facture + virement).
    const due = await dueWithBizStatus(id);
    const ids = due
      .filter(
        (c) =>
          c.bizActive &&
          Date.now() - new Date(c.created_at).getTime() >= THIRTY_DAYS
      )
      .map((c) => c.id);
    if (ids.length === 0) return Response.json({ ok: true, paid: 0 });
    const { error } = await db
      .from("affiliate_commissions")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .in("id", ids);
    if (error) return Response.json({ error: "update_failed" }, { status: 500 });
    return Response.json({ ok: true, paid: ids.length });
  }

  if (body.action === "cancel_lapsed") {
    // Client parti avant son 2e prélèvement : commission caduque (contrat).
    const due = await dueWithBizStatus(id);
    const ids = due.filter((c) => !c.bizActive).map((c) => c.id);
    if (ids.length === 0) return Response.json({ ok: true, canceled: 0 });
    const { error } = await db
      .from("affiliate_commissions")
      .update({ status: "canceled" })
      .in("id", ids);
    if (error) return Response.json({ error: "update_failed" }, { status: 500 });
    return Response.json({ ok: true, canceled: ids.length });
  }

  if (body.action === "toggle_active") {
    const { data: aff } = await db
      .from("affiliates")
      .select("active")
      .eq("id", id)
      .maybeSingle();
    if (!aff) return Response.json({ error: "not_found" }, { status: 404 });
    const { error } = await db
      .from("affiliates")
      .update({ active: !aff.active })
      .eq("id", id);
    if (error) return Response.json({ error: "update_failed" }, { status: 500 });
    return Response.json({ ok: true, active: !aff.active });
  }

  return Response.json({ error: "unknown_action" }, { status: 400 });
}
