import { notFound } from "next/navigation";
import { getAdminClient } from "@/lib/supabase/admin";
import { hasAccess } from "@/lib/auth";
import { beeperPilot } from "@/lib/beeper";
import { hardenExternalUrl } from "@/lib/wheel";
import BeeperClient from "./BeeperClient";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!beeperPilot(slug)) notFound();
  const db = getAdminClient();
  const { data: biz } = await db.from("businesses").select("id,name,status,subscription_ends_at").eq("slug", slug).maybeSingle();
  if (!biz || !hasAccess(biz)) notFound();
  const { data: cfg } = await db.from("wheel_configs").select("review_url,review_enabled").eq("business_id", biz.id).maybeSingle();
  return <BeeperClient slug={slug} name={biz.name} reviewUrl={cfg?.review_enabled ? hardenExternalUrl(cfg.review_url) : null} />;
}
