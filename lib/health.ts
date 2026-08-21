import { getAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export type HealthCheck = {
  name: string;
  ok: boolean;
  /** Détail affiché uniquement en cas de problème (ou info utile). */
  detail?: string;
};

const SITE = "https://kado-app.fr";

/** Variables d'environnement indispensables au fonctionnement. */
const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PLAYER_COOKIE_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_ROUE",
  "STRIPE_PRICE_FIDELITE",
  "STRIPE_PRICE_COMPLET",
  "STRIPE_PRICE_CAMPAIGNS",
  "STRIPE_PRICE_SETUP_REMOTE",
  "STRIPE_PRICE_SETUP_ONSITE",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "CRON_SECRET",
  "ADMIN_EMAILS",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
];

/** Tables dont l'application a besoin pour tourner. */
const REQUIRED_TABLES = [
  "businesses",
  "wheel_configs",
  "prizes",
  "plays",
  "loyalty_cards",
  "leads",
  "campaigns",
  "rate_limits",
  "products",
  "orders",
  "push_subscriptions",
  "client_push_subscriptions",
];

/** Tarifs Stripe attendus : [variable, type attendu, libellé]. */
const STRIPE_PRICES: [string, "recurring" | "one_time", string][] = [
  ["STRIPE_PRICE_ROUE", "recurring", "Jeux 29 €"],
  ["STRIPE_PRICE_FIDELITE", "recurring", "Fidélité 19 €"],
  ["STRIPE_PRICE_COMPLET", "recurring", "Complet 44 €"],
  ["STRIPE_PRICE_CAMPAIGNS", "recurring", "Campagnes 15 €"],
  ["STRIPE_PRICE_SETUP_REMOTE", "one_time", "Installation 79 €"],
  ["STRIPE_PRICE_SETUP_ONSITE", "one_time", "Installation 129 €"],
];

/**
 * Lance toutes les vérifications de santé de la plateforme.
 * Chaque contrôle est indépendant : un échec n'empêche pas les autres.
 */
export async function runHealthChecks(): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];

  // 1) Variables d'environnement
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  checks.push({
    name: "Variables d'environnement",
    ok: missing.length === 0,
    detail: missing.length ? `Manquantes : ${missing.join(", ")}` : undefined,
  });

  // 2) Base de données : chaque table doit répondre
  try {
    const db = getAdminClient();
    const broken: string[] = [];
    for (const table of REQUIRED_TABLES) {
      const { error } = await db.from(table).select("*", {
        count: "exact",
        head: true,
      });
      if (error) broken.push(table);
    }
    checks.push({
      name: `Base de données (${REQUIRED_TABLES.length} tables)`,
      ok: broken.length === 0,
      detail: broken.length
        ? `Tables en erreur : ${broken.join(", ")} — migration manquante ?`
        : undefined,
    });
  } catch (e: any) {
    checks.push({
      name: "Base de données",
      ok: false,
      detail: e?.message ?? "Connexion Supabase impossible",
    });
  }

  // 3) Stripe : les 6 tarifs existent, sont actifs et du bon type
  try {
    const stripe = getStripe();
    const issues: string[] = [];
    for (const [envKey, expected, label] of STRIPE_PRICES) {
      const id = process.env[envKey];
      if (!id) {
        issues.push(`${label} : variable ${envKey} absente`);
        continue;
      }
      try {
        const p = await stripe.prices.retrieve(id);
        if (!p.active) issues.push(`${label} : tarif archivé dans Stripe`);
        else if (p.type !== expected)
          issues.push(
            `${label} : devrait être ${
              expected === "recurring" ? "mensuel" : "ponctuel"
            }`
          );
      } catch {
        issues.push(`${label} : introuvable dans Stripe (${envKey})`);
      }
    }
    checks.push({
      name: "Tarifs Stripe (6)",
      ok: issues.length === 0,
      detail: issues.length ? issues.join(" · ") : undefined,
    });
  } catch (e: any) {
    checks.push({
      name: "Tarifs Stripe",
      ok: false,
      detail: e?.message ?? "Connexion Stripe impossible",
    });
  }

  // 4) Stripe : le webhook de production est bien en place
  try {
    const stripe = getStripe();
    const hooks = await stripe.webhookEndpoints.list({ limit: 20 });
    const found = hooks.data.find(
      (h) => h.status === "enabled" && h.url.includes("/api/billing/webhook")
    );
    checks.push({
      name: "Webhook Stripe",
      ok: !!found,
      detail: found
        ? undefined
        : "Aucun webhook actif vers /api/billing/webhook — les paiements ne mettront pas les comptes à jour !",
    });
  } catch (e: any) {
    checks.push({
      name: "Webhook Stripe",
      ok: false,
      detail: e?.message ?? "Vérification impossible",
    });
  }

  // 5) Resend : clé valide + domaine d'envoi vérifié
  try {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY absente");
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (res.status === 401) {
      // Clé « envoi uniquement » : elle envoie très bien les e-mails mais
      // n'a pas le droit de lister les domaines — pas une panne.
      checks.push({
        name: "E-mails (Resend)",
        ok: true,
        detail:
          "Clé à accès restreint (envoi uniquement) : le domaine ne peut pas être vérifié automatiquement. Pour un contrôle complet, créez une clé « Full access » dans Resend.",
      });
    } else if (!res.ok) {
      checks.push({
        name: "E-mails (Resend)",
        ok: false,
        detail: `Clé API refusée (HTTP ${res.status})`,
      });
    } else {
      const body = (await res.json()) as {
        data?: { name?: string; status?: string }[];
      };
      // même adresse de secours que lib/email.ts
      const from = process.env.EMAIL_FROM || "Kado <bonjour@kado-app.fr>";
      const domain = (from.match(/<([^>]+)>/)?.[1] ?? from)
        .split("@")[1]
        ?.trim()
        .toLowerCase();
      const entry = (body.data ?? []).find(
        (d) => d.name?.toLowerCase() === domain
      );
      const verified = entry?.status === "verified";
      checks.push({
        name: "E-mails (Resend)",
        ok: !!domain && verified,
        detail: verified
          ? undefined
          : domain
          ? `Domaine « ${domain} » non vérifié dans Resend (statut : ${
              entry?.status ?? "absent"
            })`
          : "EMAIL_FROM mal formée",
      });
    }
  } catch (e: any) {
    checks.push({
      name: "E-mails (Resend)",
      ok: false,
      detail: e?.message ?? "Vérification impossible",
    });
  }

  // 6) Site public accessible
  try {
    const res = await fetch(SITE, { cache: "no-store" });
    checks.push({
      name: "Site public (kado-app.fr)",
      ok: res.ok,
      detail: res.ok ? undefined : `Le site répond HTTP ${res.status}`,
    });
  } catch (e: any) {
    checks.push({
      name: "Site public (kado-app.fr)",
      ok: false,
      detail: e?.message ?? "Site injoignable",
    });
  }

  // 7) Le cron quotidien a bien tourné récemment (heartbeat)
  try {
    const db = getAdminClient();
    const { data } = await db
      .from("system_state")
      .select("value, updated_at")
      .eq("key", "cron_daily_last_run")
      .maybeSingle();
    if (!data) {
      checks.push({
        name: "Cron quotidien (8 h)",
        ok: true,
        detail:
          "Pas encore de passage enregistré — normal si la mise à jour date d'aujourd'hui.",
      });
    } else {
      const age = Date.now() - new Date(data.updated_at).getTime();
      const fresh = age < 26 * 3600 * 1000; // moins de 26 h
      checks.push({
        name: "Cron quotidien (8 h)",
        ok: fresh,
        detail: fresh
          ? undefined
          : `Dernier passage il y a ${Math.round(
              age / 3600 / 1000
            )} h — vérifiez les crons Vercel.`,
      });
    }
  } catch {
    checks.push({
      name: "Cron quotidien (8 h)",
      ok: true,
      detail: "Table system_state absente — exécutez la migration 0018.",
    });
  }

  return checks;
}

/** Mémorise un heartbeat/valeur système (tolérant si table absente). */
export async function setSystemState(key: string, value: string) {
  try {
    await getAdminClient()
      .from("system_state")
      .upsert({ key, value, updated_at: new Date().toISOString() });
  } catch {
    /* table absente : silencieux */
  }
}
