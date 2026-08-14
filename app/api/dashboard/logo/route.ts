import { NextRequest } from "next/server";
import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BUCKET = "logos";
const MAX_BYTES = 3 * 1024 * 1024; // 3 Mo

/** Upload du logo du commerçant connecté vers Supabase Storage. */
export async function POST(req: NextRequest) {
  const { business } = await getMyBusiness();
  if (!business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "no_file" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return Response.json({ error: "not_an_image" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "too_large" }, { status: 400 });
  }

  const db = getAdminClient();

  // Crée le bucket public s'il n'existe pas (ignore l'erreur si déjà là)
  try {
    await db.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
    });
  } catch {
    /* déjà existant */
  }

  const ext = (file.name.split(".").pop() || "png").toLowerCase().slice(0, 5);
  const path = `${business.id}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await db.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true });
  if (upErr) {
    return Response.json({ error: "upload_failed" }, { status: 500 });
  }

  const { data } = db.storage.from(BUCKET).getPublicUrl(path);
  const logoUrl = data.publicUrl;

  const { error: updErr } = await db
    .from("businesses")
    .update({ logo_url: logoUrl })
    .eq("id", business.id);
  if (updErr) {
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  return Response.json({ ok: true, logo_url: logoUrl });
}
