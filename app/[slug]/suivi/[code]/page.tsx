import { getAdminClient } from "@/lib/supabase/admin";
import { buildTheme } from "@/lib/theme";
import TrackerClient from "./TrackerClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

function Unavailable({ message }: { message: string }) {
  return (
    <main className="landing">
      <div className="landing-card">
        <div className="landing-logo">🧾</div>
        <h1>Suivi indisponible</h1>
        <p>{message}</p>
      </div>
    </main>
  );
}

export default async function SuiviPage({
  params,
}: {
  params: { slug: string; code: string };
}) {
  let db;
  try {
    db = getAdminClient();
  } catch {
    return <Unavailable message="Le service n'est pas configuré." />;
  }

  const code = params.code.trim().toUpperCase().slice(0, 12);
  const { data: biz } = await db
    .from("businesses")
    .select("id, slug, name, logo_url")
    .eq("slug", params.slug)
    .maybeSingle();
  if (!biz) return <Unavailable message="Commerce introuvable." />;

  // Commande (lecture tolérante : service_mode / table_label optionnels)
  const baseCols = "code, status, items, total_cents";
  let { data: order, error } = (await db
    .from("orders")
    .select(`${baseCols}, service_mode, table_label, buzzer_no`)
    .eq("business_id", (biz as any).id)
    .eq("code", code)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: any; error: any };
  if (error) {
    ({ data: order } = (await db
      .from("orders")
      .select(baseCols)
      .eq("business_id", (biz as any).id)
      .eq("code", code)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()) as { data: any; error: any });
  }
  if (!order) {
    return <Unavailable message="Cette commande est introuvable ou a expiré." />;
  }

  let themeCss = "";
  try {
    const { data: c } = await db
      .from("wheel_configs")
      .select("primary_color, accent_color, bg_color, bg_image_url")
      .eq("business_id", (biz as any).id)
      .maybeSingle();
    themeCss = buildTheme(
      (c as any)?.primary_color || "#ffc24d",
      (c as any)?.accent_color || "#ff5d73",
      (c as any)?.bg_color || "#150c29",
      (c as any)?.bg_image_url || null
    );
  } catch {
    themeCss = "";
  }

  return (
    <>
      {themeCss && <style dangerouslySetInnerHTML={{ __html: themeCss }} />}
      <TrackerClient
        slug={(biz as any).slug}
        name={(biz as any).name}
        code={order.code}
        initialStatus={order.status ?? "new"}
        items={order.items ?? []}
        totalCents={order.total_cents ?? 0}
        serviceMode={order.service_mode ?? "emporter"}
        tableLabel={order.table_label ?? null}
        buzzerNo={order.buzzer_no ?? null}
      />
    </>
  );
}
