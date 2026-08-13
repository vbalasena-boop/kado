export const dynamic = "force-dynamic";

/** Health-check simple — ne dépend pas de la base de données. */
export async function GET() {
  return Response.json({ status: "ok", service: "spinreview", ts: Date.now() });
}
