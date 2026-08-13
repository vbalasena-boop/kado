import { NextRequest, NextResponse } from "next/server";
import { createSSRClient } from "@/lib/supabase/ssr";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = createSSRClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${new URL(request.url).origin}/login`, {
    status: 303,
  });
}
