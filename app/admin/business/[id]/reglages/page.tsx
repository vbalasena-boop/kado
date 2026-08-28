import { getAdminUser } from "@/lib/admin-guard";
import { getAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { normalizeFeatures } from "@/lib/features";
import AdminSettings from "./AdminSettings";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getAdminUser();
  if (!user) return null; // le layout gère l'accès refusé

  const db = getAdminClient();
  const { data: biz } = await db
    .from("businesses")
    .select("id, slug, name, plan, subscription_status")
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

  // Identifiant lisible (0072) — tolérant si la colonne n'existe pas encore.
  let ref: string | null = null;
  try {
    const { data } = await db
      .from("businesses")
      .select("ref")
      .eq("id", biz.id)
      .maybeSingle();
    ref = (data as { ref?: string | null } | null)?.ref ?? null;
  } catch {
    ref = null;
  }

  // Option « Suivi au comptoir » (businesses.order_tracking) — tolérant.
  let orderTracking = false;
  try {
    const { data } = await db
      .from("businesses")
      .select("order_tracking")
      .eq("id", biz.id)
      .maybeSingle();
    orderTracking = !!(data as { order_tracking?: boolean | null } | null)
      ?.order_tracking;
  } catch {
    orderTracking = false;
  }

  // Fonctions avancées (businesses.features) — tolérant.
  let features: Record<string, boolean> = {};
  try {
    const { data } = await db
      .from("businesses")
      .select("features")
      .eq("id", biz.id)
      .maybeSingle();
    features = normalizeFeatures((data as { features?: unknown } | null)?.features);
  } catch {
    features = {};
  }

  // Bascules de la page de jeu (wheel_configs) — chacune lue tolérante.
  const wheel = {
    review_invite: false,
    convert_nudge: false,
    feedback_enabled: false,
    play_alerts: false,
  };
  try {
    const { data } = await db
      .from("wheel_configs")
      .select("review_invite, convert_nudge, feedback_enabled, play_alerts")
      .eq("business_id", biz.id)
      .maybeSingle();
    if (data) {
      const d = data as Record<string, boolean | null>;
      wheel.review_invite = !!d.review_invite;
      wheel.convert_nudge = !!d.convert_nudge;
      wheel.feedback_enabled = !!d.feedback_enabled;
      wheel.play_alerts = !!d.play_alerts;
    }
  } catch {
    /* colonnes absentes : valeurs par défaut (false) */
  }

  return (
    <AdminSettings
      businessId={biz.id}
      slug={biz.slug}
      name={biz.name}
      refCode={ref}
      plan={(biz as { plan?: string | null }).plan ?? null}
      subscriptionStatus={
        (biz as { subscription_status?: string | null }).subscription_status ??
        null
      }
      initial={{ wheel, orderTracking, features }}
    />
  );
}
