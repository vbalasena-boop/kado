import { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { imageExt, normalizeUploadedImage } from "@/lib/upload";

export const dynamic = "force-dynamic";

const BUCKET = "logos";
const MAX_BYTES = 6 * 1024 * 1024; // 6 Mo (photos plus lourdes que les logos)

/** Upload de l'image de fond de la roue du commerçant connecté. */
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
  // Type déterminé par une whitelist (SVG refusé) — pas `startsWith("image/")`.
  if (!imageExt(file.type)) {
    return Response.json({ error: "not_an_image" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "too_large" }, { status: 400 });
  }

  let normalized: Awaited<ReturnType<typeof normalizeUploadedImage>>;
  try {
    normalized = await normalizeUploadedImage(file.type, Buffer.from(await file.arrayBuffer()), MAX_BYTES);
  } catch (error) {
    const code = error instanceof Error ? error.message : "invalid_image_content";
    return Response.json({ error: code }, { status: 400 });
  }

  const db = getAdminClient();
  try {
    await db.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_BYTES });
  } catch {
    /* bucket déjà créé */
  }

  const path = `${business.id}-bg-${Date.now()}.${normalized.ext}`;

  const { error: upErr } = await db.storage
    .from(BUCKET)
    .upload(path, normalized.buffer, { contentType: file.type, upsert: true });
  if (upErr) {
    return Response.json({ error: "upload_failed" }, { status: 500 });
  }

  const { data } = db.storage.from(BUCKET).getPublicUrl(path);
  const url = data.publicUrl;

  const { error: updErr } = await db
    .from("wheel_configs")
    .update({ bg_image_url: url })
    .eq("business_id", business.id);
  if (updErr) {
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  revalidateTag(`biz-${business.slug}`, { expire: 0 });
  return Response.json({ ok: true, bg_image_url: url });
}

/** Retire l'image de fond. */
export async function DELETE() {
  const { business } = await getMyBusiness();
  if (!business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }
  const db = getAdminClient();
  await db
    .from("wheel_configs")
    .update({ bg_image_url: null })
    .eq("business_id", business.id);
  revalidateTag(`biz-${business.slug}`, { expire: 0 });
  return Response.json({ ok: true });
}
