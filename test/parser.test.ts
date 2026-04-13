import { describe, it, expect } from "vitest";
import { parseJs, parsePayload, parseRpcResponse } from "../src/parser.js";

// Minimal mock payload matching the structure expected by the parser
function makeMockJs(): string {
  const payload = [];
  // payload[0..2] unused
  payload[0] = null;
  payload[1] = null;
  payload[2] = null;

  // payload[3][0] = flight results
  payload[3] = [
    [
      // k[0] = flight, k[1] = price info
      [
        // flight[0] = type, flight[1] = airlines, flight[2] = single flights
        [
          "Nonstop", // flight[0] type
          ["Japan Airlines"], // flight[1] airlines
          [
            // single flights array
            [
              null, null, null,
              "MYJ",       // [3] from code
              "Matsuyama", // [4] from name
              "Taipei",    // [5] to name
              "TPE",       // [6] to code
              null,
              [10, 30],    // [8] departure time
              null,
              [14, 45],    // [10] arrival time
              180,         // [11] duration
              null, null, null, null, null,
              "Boeing 787", // [17] plane type
              null, null,
              [2026, 2, 16], // [20] departure date
              [2026, 2, 16], // [21] arrival date
            ],
          ],
          // flight[3..21] unused
          null, null, null, null, null, null, null, null, null,
          null, null, null, null, null, null, null, null, null, null,
          // flight[22] = extras
          [
            null, null, null, null, null, null, null,
            85000, // [7] carbon emission
            92000, // [8] typical carbon emission
          ],
        ],
        // k[1] = price wrapper
        [[null, 350]],
      ],
    ],
  ];

  // payload[4..6] unused
  payload[4] = null;
  payload[5] = null;
  payload[6] = null;

  // payload[7][1] = [alliances, airlines]
  payload[7] = [
    null,
    [
      // alliances
      [["*A", "Star Alliance"], ["OW", "Oneworld"]],
      // airlines
      [["JL", "Japan Airlines"], ["NH", "ANA"]],
    ],
  ];

  return `data:${JSON.stringify(payload)},sideChannel`;
}

describe("parser", () => {
  it("parses flight data from mock JS payload", () => {
    const js = makeMockJs();
    const results = parseJs(js);

    expect(results).toHaveLength(1);
    expect(results.metadata.alliances).toHaveLength(2);
    expect(results.metadata.airlines).toHaveLength(2);
    expect(results.metadata.airlines[0]).toEqual({
      code: "JL",
      name: "Japan Airlines",
    });

    const flight = results[0];
    expect(flight.type).toBe("Nonstop");
    expect(flight.price).toBe(350);
    expect(flight.airlines).toEqual(["Japan Airlines"]);
    expect(flight.flights).toHaveLength(1);

    const sf = flight.flights[0];
    expect(sf.from_airport).toEqual({ code: "MYJ", name: "Matsuyama" });
    expect(sf.to_airport).toEqual({ code: "TPE", name: "Taipei" });
    expect(sf.departure.time).toEqual([10, 30]);
    expect(sf.arrival.time).toEqual([14, 45]);
    expect(sf.duration).toBe(180);
    expect(sf.plane_type).toBe("Boeing 787");
    expect(flight.carbon.emission).toBe(85000);
    expect(flight.carbon.typical_on_route).toBe(92000);
  });

  it("parsePayload extracts best and other flights", () => {
    const flightEntry = (price: number) => [
      [
        "Nonstop", ["TestAir"],
        [[null, null, null, "AAA", "A", "B", "BBB", null, [10, 0], null, [12, 0], 120,
          null, null, null, null, null, "737", null, null, [2026, 1, 1], [2026, 1, 1]]],
        null, null, null, null, null, null, null, null, null,
        null, null, null, null, null, null, null, null, null, null,
        [null, null, null, null, null, null, null, 100, 200],
      ],
      [[null, price]],
    ];

    const payload: any[] = [];
    payload[2] = [[flightEntry(100), flightEntry(150)]]; // best flights
    payload[3] = [[flightEntry(300), flightEntry(400)]]; // other flights
    payload[7] = [null, [[["SA", "Star Alliance"]], [["TA", "TestAir"]]]];

    const results = parsePayload(payload);
    expect(results).toHaveLength(4); // 2 best + 2 other
    expect(results[0].price).toBe(100);
    expect(results[1].price).toBe(150);
    expect(results[2].price).toBe(300);
    expect(results[3].price).toBe(400);
  });

  it("parseRpcResponse strips prefix and parses nested JSON", () => {
    const payload: any[] = [];
    payload[2] = null;
    payload[3] = [[[
      [
        "Direct", ["UA"],
        [[null, null, null, "SFO", "SF", "Tokyo", "NRT", null, [10, 0], null, [14, 0], 600,
          null, null, null, null, null, "777", null, null, [2026, 5, 1], [2026, 5, 2]]],
        null, null, null, null, null, null, null, null, null,
        null, null, null, null, null, null, null, null, null, null,
        [null, null, null, null, null, null, null, 500, 600],
      ],
      [[null, 999]],
    ]]];
    payload[7] = [null, [[["SA", "Star"]], [["UA", "United"]]]];

    const innerJson = JSON.stringify(payload);
    const outerJson = JSON.stringify([[null, null, innerJson]]);
    const rpcText = ")]}'\n" + outerJson;

    const results = parseRpcResponse(rpcText);
    expect(results).toHaveLength(1);
    expect(results[0].price).toBe(999);
    expect(results[0].airlines).toEqual(["UA"]);
  });

  it("returns empty results when payload[3][0] is null", () => {
    const payload = [null, null, null, [null], null, null, null, [null, [
      [["*A", "Star Alliance"]],
      [["JL", "Japan Airlines"]],
    ]]];
    const js = `data:${JSON.stringify(payload)},sideChannel`;
    const results = parseJs(js);
    expect(results).toHaveLength(0);
    expect(results.metadata).toBeDefined();
  });
});
