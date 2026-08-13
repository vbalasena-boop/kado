import { getAdminUser } from "@/lib/admin-guard";
import { getAdminClient } from "@/lib/supabase/admin";
import AdminClient, { AdminBusiness } from "./AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getAdminUser();
  if (!user) return null; // le layout gère l'accès refusé

  const admin = getAdminClient();
  const { data: businesses } = await admin
    .from("businesses")
    .select(
      "id, slug, name, status, subscription_status, owner_user_id, created_at"
    )
    .order("created_at", { ascending: false });

  const { data: playRows } = await admin.from("plays").select("business_id");
  const counts = new Map<string, number>();
  for (const r of playRows ?? [])
    counts.set(r.business_id, (counts.get(r.business_id) ?? 0) + 1);

  // e-mails des propriétaires
  const emailById = new Map<string, string>();
  try {
    const { data: usersList } = await admin.auth.admin.listUsers();
    for (const u of usersList?.users ?? [])
      if (u.email) emailById.set(u.id, u.email);
  } catch {
    /* ignore */
  }

  const rows: AdminBusiness[] = (businesses ?? []).map((b) => ({
    id: b.id,
    slug: b.slug,
    name: b.name,
    status: b.status,
    subscription_status: b.subscription_status,
    plays: counts.get(b.id) ?? 0,
    owner_email: b.owner_user_id
      ? emailById.get(b.owner_user_id) ?? "(compte non trouvé)"
      : "(non lié)",
    created_at: b.created_at,
  }));

  return <AdminClient businesses={rows} />;
}
