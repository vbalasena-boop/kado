import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PROSPECT_STATUSES,
  MESSAGE_CHANNELS,
  MESSAGE_STATUSES,
  SUPPRESSION_REASONS,
  isContactable,
} from "@/lib/prospection/types";

/**
 * Garde-fou : les constantes TS doivent rester alignées avec les contraintes
 * CHECK de la migration. Si l'un des deux change sans l'autre, ce test casse.
 */
const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/0043_prospection.sql"),
  "utf8"
);

describe("cohérence types prospection ↔ migration SQL", () => {
  it("tous les statuts de prospect sont dans la contrainte CHECK", () => {
    for (const status of PROSPECT_STATUSES) {
      expect(migration).toContain(`'${status}'`);
    }
  });

  it("les canaux de message figurent dans la migration", () => {
    for (const channel of MESSAGE_CHANNELS) {
      expect(migration).toContain(`'${channel}'`);
    }
  });

  it("les statuts de message figurent dans la migration", () => {
    for (const status of MESSAGE_STATUSES) {
      expect(migration).toContain(`'${status}'`);
    }
  });

  it("les motifs de suppression figurent dans la migration", () => {
    for (const reason of SUPPRESSION_REASONS) {
      expect(migration).toContain(`'${reason}'`);
    }
  });

  it("crée bien les 4 tables du module", () => {
    for (const table of [
      "prospects",
      "prospect_messages",
      "prospect_events",
      "suppression_list",
    ]) {
      expect(migration).toContain(`create table if not exists ${table}`);
    }
  });

  it("active RLS sur les 4 tables (aucun accès client direct)", () => {
    for (const table of [
      "prospects",
      "prospect_messages",
      "prospect_events",
      "suppression_list",
    ]) {
      expect(migration).toContain(
        `alter table ${table} enable row level security`
      );
    }
  });
});

describe("isContactable", () => {
  it("un prospect neuf est contactable", () => {
    expect(isContactable("new")).toBe(true);
    expect(isContactable("queued")).toBe(true);
  });

  it("un prospect traité ou exclu n'est plus contactable", () => {
    expect(isContactable("replied")).toBe(false);
    expect(isContactable("client")).toBe(false);
    expect(isContactable("excluded")).toBe(false);
  });
});
