import { getAdminClient } from "@/lib/supabase/admin";
import { hasAccess } from "@/lib/auth";
import { buildTheme } from "@/lib/theme";
import TakeNumber from "./TakeNumber";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

function Unavailable({ message }: { message: string }) {
  return (
    <main className="landing">
      <div className="landing-card">
        <div className="landing-logo">🎫</div>
        <h1>Suivi indisponible</h1>
        <p>{message}</p>
      </div>
    </main>
  );
}

export default async function SuiviIndexPage({
  params,
}: {
  params: { slug: string };
}) {
  let db;
  try {
    db = getAdminClient();
  } catch {
    return <Unavailable message="Le service n'est pas configuré." />;
  }

  const { data: biz } = await db
    .from("businesses")
    .select("id, slug, name, logo_url, status, subscription_status, subscription_ends_at")
    .eq("slug", params.slug)
    .maybeSingle();
  if (!biz) return <Unavailable message="Commerce introuvable." />;
  if (!hasAccess(biz)) {
    return <Unavailable message="Le suivi est momentanément indisponible." />;
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
      <TakeNumber slug={(biz as any).slug} name={(biz as any).name} />
    </>
  );
}
