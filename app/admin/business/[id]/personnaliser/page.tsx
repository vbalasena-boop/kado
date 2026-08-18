import { getAdminUser } from "@/lib/admin-guard";
import { getAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import AdminThemeEditor from "./AdminThemeEditor";

export const dynamic = "force-dynamic";

export default async function AdminPersonalisePage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getAdminUser();
  if (!user) return null; // le layout gère l'accès refusé

  const db = getAdminClient();
  const { data: biz } = await db
    .from("businesses")
    .select("id, slug, name, setup_option, setup_paid_at")
    .eq("id", params.id)
    .maybeSingle();

  if (!biz) {
    return (
      <div className="dash-card">
        <h2>Établissement introuvable</h2>
        <Link href="/admin" className="btn-secondary">
          ← Retour à l'admin
        </Link>
      </div>
    );
  }

  // Config actuelle (couleurs + décor + verrou) — lecture tolérante.
  let primary = "#ffc24d";
  let accent = "#ff5d73";
  let bg = "#150c29";
  let decor = "";
  let locked = false;
  const { data: cfg } = await db
    .from("wheel_configs")
    .select("primary_color, accent_color, bg_color")
    .eq("business_id", biz.id)
    .maybeSingle();
  if (cfg) {
    primary = (cfg as any).primary_color ?? primary;
    accent = (cfg as any).accent_color ?? accent;
    bg = (cfg as any).bg_color ?? bg;
  }
  const { data: dec } = await db
    .from("wheel_configs")
    .select("decor_emojis")
    .eq("business_id", biz.id)
    .maybeSingle();
  decor = (dec as any)?.decor_emojis ?? "";
  const { data: lk } = await db
    .from("wheel_configs")
    .select("theme_locked")
    .eq("business_id", biz.id)
    .maybeSingle();
  locked = !!(lk as any)?.theme_locked;

  return (
    <AdminThemeEditor
      businessId={biz.id}
      slug={biz.slug}
      name={biz.name}
      hasInstall={!!(biz as any).setup_paid_at}
      installKind={(biz as any).setup_option ?? null}
      initial={{ primary, accent, bg, decor, locked }}
    />
  );
}
