import { describe, it, expect } from "vitest";
import { createQuery, Passengers, Query } from "../src/query.js";

describe("createQuery", () => {
  it("creates a basic one-way query", () => {
    const q = createQuery({
      flights: [
        { date: "2026-02-16", from_airport: "MYJ", to_airport: "TPE" },
      ],
      seat: "economy",
      trip: "one-way",
      passengers: new Passengers({ adults: 1 }),
    });

    expect(q).toBeInstanceOf(Query);
    expect(q.toStr()).toBe("GhoSCjIwMjYtMDItMTZqBRIDTVlKcgUSA1RQRUIBAUgBmAEC");
  });

  it("generates correct URL", () => {
    const q = createQuery({
      flights: [
        { date: "2026-02-16", from_airport: "MYJ", to_airport: "TPE" },
      ],
      seat: "economy",
      trip: "one-way",
      passengers: new Passengers({ adults: 1 }),
      language: "zh-TW",
      currency: "TWD",
    });

    const url = q.url();
    expect(url).toContain("tfs=");
    expect(url).toContain("hl=zh-TW");
    expect(url).toContain("curr=TWD");
  });

  it("generates correct params", () => {
    const q = createQuery({
      flights: [
        { date: "2026-02-16", from_airport: "MYJ", to_airport: "TPE" },
      ],
      language: "en-US",
      currency: "USD",
    });

    const params = q.params();
    expect(params).toHaveProperty("tfs");
    expect(params).toHaveProperty("hl", "en-US");
    expect(params).toHaveProperty("curr", "USD");
  });
});

describe("Passengers", () => {
  it("validates max passengers", () => {
    expect(() => new Passengers({ adults: 10 })).toThrow("Too many passengers");
  });

  it("validates infants on lap", () => {
    expect(
      () => new Passengers({ adults: 1, infants_on_lap: 2 }),
    ).toThrow("Must have at least one adult per infant on lap");
  });

  it("creates valid passenger list", () => {
    const p = new Passengers({ adults: 2, children: 1 });
    const pb = p.toPb();
    expect(pb).toHaveLength(3);
  });
});
