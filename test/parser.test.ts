import { describe, it, expect } from "vitest";
import { parseJs } from "../src/parser.js";

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
