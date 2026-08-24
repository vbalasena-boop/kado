import { NextRequest } from "next/server";
import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { imageExt } from "@/lib/upload";

export const dynamic = "force-dynamic";

const BUCKET = "products";
const MAX_BYTES = 4 * 1024 * 1024; // 4 Mo

/** Upload de la photo d'un produit du commerçant connecté. */
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
  const productId = String(form.get("id") ?? "");
  if (!(file instanceof File) || !productId) {
    return Response.json({ error: "no_file" }, { status: 400 });
  }
  // Type déterminé par une whitelist (SVG refusé) — pas `startsWith("image/")`.
  const ext = imageExt(file.type);
  if (!ext) {
    return Response.json({ error: "not_an_image" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "too_large" }, { status: 400 });
  }

  const db = getAdminClient();

  // Le produit doit appartenir au commerçant connecté
  const { data: product } = await db
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!product) return Response.json({ error: "not_found" }, { status: 404 });

  try {
    await db.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
    });
  } catch {
    /* déjà existant */
  }

  const path = `${business.id}/${productId}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await db.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true });
  if (upErr) {
    return Response.json({ error: "upload_failed" }, { status: 500 });
  }

  const { data } = db.storage.from(BUCKET).getPublicUrl(path);
  const { error: updErr } = await db
    .from("products")
    .update({ image_url: data.publicUrl })
    .eq("id", productId)
    .eq("business_id", business.id);
  if (updErr) {
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  return Response.json({ ok: true, image_url: data.publicUrl });
}
