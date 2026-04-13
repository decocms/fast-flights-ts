import { describe, it, expect } from "vitest";
import { createQuery, Passengers } from "../src/query.js";
import { buildRpcUrl, buildRpcPayload } from "../src/fetcher.js";

describe("buildRpcUrl", () => {
  it("includes curr param when currency is set", () => {
    const q = createQuery({
      flights: [{ date: "2026-05-25", from_airport: "GIG", to_airport: "SFO" }],
      currency: "USD",
    });
    const url = buildRpcUrl(q);
    expect(url).toContain("curr=USD");
  });

  it("includes hl param when language is set", () => {
    const q = createQuery({
      flights: [{ date: "2026-05-25", from_airport: "GIG", to_airport: "SFO" }],
      language: "pt-BR",
    });
    const url = buildRpcUrl(q);
    expect(url).toContain("hl=pt-BR");
  });

  it("includes both curr and hl when both are set", () => {
    const q = createQuery({
      flights: [{ date: "2026-05-25", from_airport: "GIG", to_airport: "SFO" }],
      currency: "JPY",
      language: "ja",
    });
    const url = buildRpcUrl(q);
    expect(url).toContain("curr=JPY");
    expect(url).toContain("hl=ja");
  });

  it("returns bare RPC URL when neither is set", () => {
    const q = createQuery({
      flights: [{ date: "2026-05-25", from_airport: "GIG", to_airport: "SFO" }],
    });
    const url = buildRpcUrl(q);
    expect(url).not.toContain("?");
    expect(url).toContain("GetShoppingResults");
  });
});

describe("buildRpcPayload", () => {
  it("encodes trip type correctly", () => {
    const oneWay = createQuery({
      flights: [{ date: "2026-05-25", from_airport: "GIG", to_airport: "SFO" }],
      trip: "one-way",
    });
    const mc = createQuery({
      flights: [
        { date: "2026-05-21", from_airport: "GIG", to_airport: "LAX" },
        { date: "2026-05-28", from_airport: "SFO", to_airport: "GIG" },
      ],
      trip: "multi-city",
    });

    const owBody = buildRpcPayload(oneWay);
    const mcBody = buildRpcPayload(mc);

    // Decode the f.req to inspect the filters
    const owFilters = JSON.parse(JSON.parse(decodeURIComponent(owBody.replace("f.req=", "")))[1]);
    const mcFilters = JSON.parse(JSON.parse(decodeURIComponent(mcBody.replace("f.req=", "")))[1]);

    // filters[1][2] = trip type
    expect(owFilters[1][2]).toBe(2); // ONE_WAY
    expect(mcFilters[1][2]).toBe(3); // MULTI_CITY
  });

  it("encodes seat type correctly", () => {
    const q = createQuery({
      flights: [{ date: "2026-05-25", from_airport: "GIG", to_airport: "SFO" }],
      seat: "business",
    });
    const body = buildRpcPayload(q);
    const filters = JSON.parse(JSON.parse(decodeURIComponent(body.replace("f.req=", "")))[1]);
    expect(filters[1][5]).toBe(3); // BUSINESS
  });

  it("encodes passengers correctly", () => {
    const q = createQuery({
      flights: [{ date: "2026-05-25", from_airport: "GIG", to_airport: "SFO" }],
      passengers: new Passengers({ adults: 2, children: 1 }),
    });
    const body = buildRpcPayload(q);
    const filters = JSON.parse(JSON.parse(decodeURIComponent(body.replace("f.req=", "")))[1]);
    expect(filters[1][6]).toEqual([2, 1, 0, 0]);
  });

  it("encodes segments with airports and dates", () => {
    const q = createQuery({
      flights: [
        { date: "2026-05-21", from_airport: "GIG", to_airport: "LAX" },
        { date: "2026-05-28", from_airport: "SFO", to_airport: "GIG" },
      ],
      trip: "multi-city",
    });
    const body = buildRpcPayload(q);
    const filters = JSON.parse(JSON.parse(decodeURIComponent(body.replace("f.req=", "")))[1]);
    const segments = filters[1][13];

    expect(segments).toHaveLength(2);
    expect(segments[0][0]).toEqual([[["GIG", 0]]]);
    expect(segments[0][1]).toEqual([[["LAX", 0]]]);
    expect(segments[0][6]).toBe("2026-05-21");
    expect(segments[1][0]).toEqual([[["SFO", 0]]]);
    expect(segments[1][1]).toEqual([[["GIG", 0]]]);
    expect(segments[1][6]).toBe("2026-05-28");
  });

  it("encodes max_stops in segment", () => {
    const q = createQuery({
      flights: [{ date: "2026-05-25", from_airport: "GIG", to_airport: "SFO", max_stops: 1 }],
    });
    const body = buildRpcPayload(q);
    const filters = JSON.parse(JSON.parse(decodeURIComponent(body.replace("f.req=", "")))[1]);
    expect(filters[1][13][0][3]).toBe(2); // max_stops + 1
  });
});
