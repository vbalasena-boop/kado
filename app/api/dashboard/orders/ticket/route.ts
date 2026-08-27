import { merchantRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { pickupCode } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * « Donner un numéro » depuis la caisse — pour un client SANS téléphone. Le
 * commerçant génère un numéro (atomique, remis à zéro chaque jour) et le
 * communique de vive voix. La commande apparaît dans sa file comme un bipeur.
 */
export const POST = merchantRoute({
  handler: async ({ business }) => {
    const db = getAdminClient();

    // Numéro du jour, atomique (RPC 0067) ; repli max+1 si absente.
    let number: number | null = null;
    const { data: rpcNo, error: rpcErr } = await db.rpc("next_buzzer_no", {
      biz: business.id,
    });
    if (!rpcErr && typeof rpcNo === "number") {
      number = rpcNo;
    } else {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      try {
        const { data: last, error } = await db
          .from("orders")
          .select("buzzer_no")
          .eq("business_id", business.id)
          .gte("created_at", startOfDay.toISOString())
          .not("buzzer_no", "is", null)
          .order("buzzer_no", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!error) number = (((last as any)?.buzzer_no as number) ?? 0) + 1;
      } catch {
        number = null;
      }
    }

    const code = pickupCode();
    const base: Record<string, unknown> = {
      business_id: business.id,
      code,
      customer_name: number ? `N° ${number}` : "Comptoir",
      customer_phone: "",
      pickup_at: "Sur place",
      note: null,
      items: [],
      total_cents: 0,
      status: "new",
    };
    const optional: Record<string, unknown> = { ...base, service_mode: "buzzer" };
    if (number != null) optional.buzzer_no = number;

    let { error } = await db.from("orders").insert(optional);
    if (error) {
      ({ error } = await db.from("orders").insert(base));
    }
    if (error) return Response.json({ error: "save_failed" }, { status: 500 });

    return Response.json({ ok: true, code, number });
  },
});
