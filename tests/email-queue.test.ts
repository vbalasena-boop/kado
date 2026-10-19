import { describe, it, expect, vi, beforeEach } from "vitest";
import { drainEmailQueue, nextQueueState } from "@/lib/email-queue";

const sendEmail = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email", () => ({ sendEmail }));

describe("nextQueueState", () => {
  it("envoi réussi → sent, tentative incrémentée", () => {
    expect(nextQueueState(0, true)).toEqual({ status: "sent", attempts: 1 });
  });

  it("clé absente (skipped) → failed d'emblée (inutile de réessayer)", () => {
    expect(nextQueueState(0, false, true)).toEqual({
      status: "failed",
      attempts: 1,
    });
  });

  it("échec passager → reste pending tant qu'il reste des tentatives", () => {
    expect(nextQueueState(0, false)).toEqual({ status: "pending", attempts: 1 });
    expect(nextQueueState(3, false)).toEqual({ status: "pending", attempts: 4 });
  });

  it("échec passager après 5 tentatives → failed", () => {
    expect(nextQueueState(4, false)).toEqual({ status: "failed", attempts: 5 });
  });
});

describe("drainEmailQueue — réservation et finalisation", () => {
  const row = {
    id: "email-1",
    business_id: "biz-1",
    lock_token: "lease-1",
    to_addr: "client@example.com",
    subject: "Offre",
    html: "<p>Bonjour</p>",
    from_name: "Kado",
    marketing: true,
    attempts: 0,
  };

  beforeEach(() => sendEmail.mockReset());

  it("réserve le lot puis ne finalise qu'avec le jeton de réservation", async () => {
    sendEmail.mockResolvedValue({ ok: true });
    const select = vi.fn().mockResolvedValue({ data: [{ id: row.id }], error: null });
    const eqToken = vi.fn(() => ({ select }));
    const eqId = vi.fn(() => ({ eq: eqToken }));
    const db: any = {
      rpc: vi.fn((name: string) => Promise.resolve(
        name === "claim_email_queue"
          ? { data: [row], error: null }
          : { data: true, error: null },
      )),
      from: vi.fn(() => ({ update: vi.fn(() => ({ eq: eqId })) })),
    };

    const result = await drainEmailQueue(db, { max: 10 });

    expect(db.rpc).toHaveBeenCalledWith("claim_email_queue", { batch_size: 10 });
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(eqId).toHaveBeenCalledWith("id", row.id);
    expect(eqToken).toHaveBeenCalledWith("lock_token", row.lock_token);
    expect(select).toHaveBeenCalledWith("id");
    expect(result).toEqual({ sent: 1, failed: 0, remaining: false });
  });

  it("remonte l'indisponibilité de la réservation au cron", async () => {
    const db: any = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "missing function" } }),
    };
    await expect(drainEmailQueue(db, { max: 10 })).rejects.toThrow("email_queue_claim_failed");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("n'envoie pas une offre si le consentement a été retiré", async () => {
    const select = vi.fn().mockResolvedValue({ data: [{ id: row.id }], error: null });
    const eqToken = vi.fn(() => ({ select }));
    const eqId = vi.fn(() => ({ eq: eqToken }));
    const db: any = {
      rpc: vi.fn((name: string) => Promise.resolve(
        name === "claim_email_queue"
          ? { data: [row], error: null }
          : { data: false, error: null },
      )),
      from: vi.fn(() => ({ update: vi.fn(() => ({ eq: eqId })) })),
    };

    const result = await drainEmailQueue(db, { max: 10 });

    expect(sendEmail).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, failed: 1, remaining: false });
  });

  it("ne signale pas un envoi comme finalisé si son bail a changé", async () => {
    sendEmail.mockResolvedValue({ ok: true });
    const db: any = {
      rpc: vi.fn((name: string) => Promise.resolve(
        name === "claim_email_queue"
          ? { data: [row], error: null }
          : { data: true, error: null },
      )),
      from: vi.fn(() => ({ update: vi.fn(() => ({ eq: vi.fn(() => ({
        eq: vi.fn(() => ({ select: vi.fn().mockResolvedValue({ data: [], error: null }) })),
      })) })) })),
    };
    await expect(drainEmailQueue(db, { max: 10 })).rejects.toThrow("email_queue_lease_lost_after_send");
  });
});
