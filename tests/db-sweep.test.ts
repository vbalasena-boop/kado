import { describe, it, expect, vi, beforeEach } from "vitest";

// Sweep observabilité erreurs Supabase (Story 2). Cas couvert ici : le
// désabonnement push (`body.remove`) où le delete EST le but de la requête.
//  - table absente (42P01) → toléré, { ok:true }, PAS de reportError ;
//  - vraie erreur (23514) → reportError + 500 { error:"remove_failed" } ;
//  - throw réseau → capturé par le catch → reportError + 500 remove_failed.
// (Les blocs onboarding/connect sont « secondaires » : ils ne changent pas le
// flux ; leur non-régression est couverte par tsc/lint et la revue.)

// Erreur simulée sur la chaîne delete().eq().eq() : null par défaut.
let removeError: any = null;
// Si true, la chaîne REJETTE (throw réseau) au lieu de résoudre { error }.
let removeReject = false;

function makeBuilder() {
  const b: any = {};
  b.delete = () => b;
  b.eq = () => b;
  b.upsert = () => Promise.resolve({ error: null });
  // Rend le builder « awaitable » : délégué du delete().eq().eq().
  b.then = (resolve: any, reject: any) =>
    removeReject ? reject(new Error("network down")) : resolve({ error: removeError });
  return b;
}

// merchantRoute/publicRoute réels feraient l'auth + le parse zod ; ici on les
// remplace par un wrapper minimal qui parse le corps et injecte un business.
vi.mock("@/lib/api", () => ({
  merchantRoute: (opts: any) => async (req: any) => {
    const raw = await req.json();
    const body = opts.schema ? opts.schema.parse(raw) : raw;
    return opts.handler({
      req,
      params: {},
      body,
      business: { id: "biz1", slug: "demo" },
      user: { id: "u1" },
    });
  },
  publicRoute: (opts: any) => async (req: any) => {
    const raw = await req.json();
    const body = opts.schema ? opts.schema.parse(raw) : raw;
    return opts.handler({ req, params: {}, body, user: { id: "u1" } });
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({ from: () => makeBuilder() }),
}));
vi.mock("@/lib/report", () => ({ reportError: vi.fn() }));

import { reportError } from "@/lib/report";
import { POST as pushPost } from "@/app/api/dashboard/push/route";

function removeReq() {
  return new Request("http://localhost/api/dashboard/push", {
    method: "POST",
    body: JSON.stringify({ endpoint: "https://push.example/abc", remove: true }),
    headers: { "content-type": "application/json" },
  }) as any;
}

describe("POST /api/dashboard/push — désabonnement (delete est le but)", () => {
  beforeEach(() => {
    removeError = null;
    removeReject = false;
    (reportError as any).mockClear();
  });

  it("table absente (42P01) → toléré, { ok:true }, aucun reportError", async () => {
    removeError = { code: "42P01", message: 'relation "push_subscriptions" does not exist' };
    const res = await pushPost(removeReq());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(reportError as any).not.toHaveBeenCalled();
  });

  it("vraie erreur (23514) → reportError + 500 remove_failed", async () => {
    removeError = { code: "23514", message: "check constraint violated" };
    const res = await pushPost(removeReq());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "remove_failed" });
    expect(reportError as any).toHaveBeenCalledTimes(1);
  });

  it("throw réseau → capturé (catch) → reportError + 500 remove_failed", async () => {
    removeReject = true;
    const res = await pushPost(removeReq());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "remove_failed" });
    expect(reportError as any).toHaveBeenCalledTimes(1);
  });
});
