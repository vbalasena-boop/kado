export type BeeperStatus = "preparing" | "ready" | "collected";
export type BeeperOrder = { id: string; number: number; status: BeeperStatus };
export function previousBeeperStatus(next: unknown): BeeperStatus | null {
  return next === "ready" ? "preparing" : next === "collected" ? "ready" : null;
}
export function beeperPilot(slug: string): boolean {
  return !!process.env.BEEPER_PILOT_SLUG && slug === process.env.BEEPER_PILOT_SLUG;
}
export const BEEPER_LABELS = { preparing: "En préparation", ready: "Prête", collected: "Récupérée" };
