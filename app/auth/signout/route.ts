import { NextRequest, NextResponse } from "next/server";
import { createSSRClient } from "@/lib/supabase/ssr";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = createSSRClient();
  // Déconnexion locale uniquement : ne ferme que l'appareil courant.
  // (Par défaut Supabase déconnecte TOUS les appareils — ce qui empêche le
  //  commerçant de rester connecté simultanément sur son téléphone, sa
  //  tablette de caisse, son ordinateur, etc.)
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(`${new URL(request.url).origin}/login`, {
    status: 303,
  });
}
