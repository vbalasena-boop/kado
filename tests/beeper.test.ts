import { describe, expect, it, afterEach, vi } from "vitest";
import { beeperPilot, previousBeeperStatus } from "@/lib/beeper";
describe("beeper", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("limite le pilote au commerce configuré", () => {
    vi.stubEnv("BEEPER_PILOT_SLUG", "cafe");
    expect(beeperPilot("cafe")).toBe(true);
    expect(beeperPilot("autre")).toBe(false);
    vi.stubEnv("BEEPER_PILOT_SLUG", "");
    expect(beeperPilot("")).toBe(false);
  });
  it("impose préparation → prête → récupérée", () => {
    expect(previousBeeperStatus("ready")).toBe("preparing");
    expect(previousBeeperStatus("collected")).toBe("ready");
    expect(previousBeeperStatus("preparing")).toBeNull();
    expect(previousBeeperStatus("unknown")).toBeNull();
  });
});
