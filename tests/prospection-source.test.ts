import { describe, it, expect } from "vitest";
import { toRow, partitionNew } from "@/lib/prospection/source";
import type { SourcedProspect } from "@/lib/prospection/places";

function sp(place_id: string, over: Partial<SourcedProspect> = {}): SourcedProspect {
  return {
    place_id,
    name: `Commerce ${place_id}`,
    category: "resto",
    city: "Lyon",
    address: null,
    google_rating: 4.0,
    google_reviews_count: 12,
    website: null,
    primary_type: null,
    ...over,
  };
}

describe("toRow", () => {
  it("mappe un prospect sourcé en ligne de base au statut 'new'", () => {
    const row = toRow(sp("a", { google_reviews_count: 5 }));
    expect(row).toMatchObject({
      place_id: "a",
      category: "resto",
      city: "Lyon",
      google_reviews_count: 5,
      status: "new",
    });
    // pas de champ "primary_type" dans la ligne de base
    expect("primary_type" in row).toBe(false);
  });
});

describe("partitionNew", () => {
  it("écarte les place_id déjà présents en base", () => {
    const { toInsert, duplicates } = partitionNew(
      [sp("a"), sp("b"), sp("c")],
      new Set(["b"])
    );
    expect(toInsert.map((p) => p.place_id)).toEqual(["a", "c"]);
    expect(duplicates.map((p) => p.place_id)).toEqual(["b"]);
  });

  it("déduplique aussi les doublons internes au lot", () => {
    const { toInsert, duplicates } = partitionNew(
      [sp("a"), sp("a"), sp("d")],
      new Set()
    );
    expect(toInsert.map((p) => p.place_id)).toEqual(["a", "d"]);
    expect(duplicates.map((p) => p.place_id)).toEqual(["a"]);
  });

  it("tout est nouveau quand la base est vide et le lot unique", () => {
    const { toInsert, duplicates } = partitionNew([sp("x"), sp("y")], new Set());
    expect(toInsert).toHaveLength(2);
    expect(duplicates).toHaveLength(0);
  });
});
