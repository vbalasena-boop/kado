import { NextRequest } from "next/server";
import { runHealthChecks, setSystemState } from "@/lib/health";
import { sendEmail, emailLayout } from "@/lib/email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Vérification de santé quotidienne (cron Vercel, 30 min après le cron
 * principal). Contrôle base, Stripe, Resend, site et cron — et alerte
 * l'admin par e-mail uniquement si quelque chose ne va pas.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const checks = await runHealthChecks();
  const failures = checks.filter((c) => !c.ok);

  await setSystemState(
    "health_last_run",
    JSON.stringify({ ok: failures.length === 0, failures: failures.length })
  );

  // Alerte e-mail à l'admin uniquement en cas de problème
  if (failures.length > 0) {
    const adminEmail = (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim();
    if (adminEmail) {
      const list = failures
        .map(
          (f) =>
            `<li style="margin:0 0 10px;"><b>❌ ${f.name}</b>${
              f.detail ? `<br><span style="color:#6b6089;">${f.detail}</span>` : ""
            }</li>`
        )
        .join("");
      await sendEmail({
        to: adminEmail,
        subject: `⚠️ Kado — ${failures.length} vérification${
          failures.length > 1 ? "s" : ""
        } en échec`,
        html: emailLayout({
          preview: "La vérification automatique a détecté un problème.",
          emoji: "🩺",
          heading: "Un problème détecté sur Kado",
          bodyHtml: `
            <p style="margin:0 0 14px;">La vérification automatique quotidienne
            a détecté ${failures.length > 1 ? "des problèmes" : "un problème"}
            (${failures.length}/${checks.length} contrôles en échec) :</p>
            <ul style="margin:0 0 16px;padding-left:18px;">${list}</ul>
            <p style="margin:0;">Le détail complet est visible en haut de votre
            <a href="https://kado-app.fr/admin" style="color:#f0a52e;">page admin</a>.</p>`,
        }),
        text: `Kado — ${failures.length} vérification(s) en échec : ${failures
          .map((f) => f.name)
          .join(", ")}. Détails sur kado-app.fr/admin`,
      });
    }
  }

  return Response.json({
    ok: failures.length === 0,
    total: checks.length,
    failures: failures.map((f) => ({ name: f.name, detail: f.detail })),
  });
}
