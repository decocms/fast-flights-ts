#!/usr/bin/env node
// CLI entry point for cross-language benchmarks.
// Usage: npx tsx bench/cli.ts [encode|parse|both] [iterations]

import { encodeInfoToBase64, Seat, Trip, Passenger } from "../src/protobuf.js";
import { createQuery, Passengers } from "../src/query.js";
import { parseJs } from "../src/parser.js";

const mode = process.argv[2] || "both";
const iterations = parseInt(process.argv[3] || "10000", 10);

function benchEncode(n: number): void {
  for (let i = 0; i < n; i++) {
    const q = createQuery({
      flights: [
        { date: "2026-02-16", from_airport: "MYJ", to_airport: "TPE" },
      ],
      seat: "economy",
      trip: "one-way",
      passengers: new Passengers({ adults: 1 }),
    });
    q.toStr();
  }
}

function buildPayload(): string {
  const flights = [];
  for (let i = 0; i < 20; i++) {
    flights.push([
      [
        "Nonstop",
        ["Japan Airlines", "ANA"],
        [
          [
            null, null, null,
            "MYJ", "Matsuyama", "Taipei", "TPE",
            null, [10, 30], null, [14, 45], 180,
            null, null, null, null, null,
            "Boeing 787", null, null,
            [2026, 2, 16], [2026, 2, 16],
          ],
        ],
        null, null, null, null, null, null, null, null, null,
        null, null, null, null, null, null, null, null, null, null,
        [null, null, null, null, null, null, null, 85000, 92000],
      ],
      [[null, 350 + i]],
    ]);
  }
  const payload = [
    null, null, null, [flights],
    null, null, null,
    [null, [
      [["*A", "Star Alliance"], ["OW", "Oneworld"]],
      [["JL", "Japan Airlines"], ["NH", "ANA"]],
    ]],
  ];
  return `data:${JSON.stringify(payload)},sideChannel`;
}

function benchParse(n: number): void {
  const js = buildPayload();
  for (let i = 0; i < n; i++) {
    parseJs(js);
  }
}

if (mode === "encode" || mode === "both") {
  const start = performance.now();
  benchEncode(iterations);
  const elapsed = performance.now() - start;
  console.log(`[TS] encode x${iterations}: ${elapsed.toFixed(2)}ms (${(iterations / elapsed * 1000).toFixed(0)} ops/sec)`);
}

if (mode === "parse" || mode === "both") {
  const start = performance.now();
  benchParse(iterations);
  const elapsed = performance.now() - start;
  console.log(`[TS] parse x${iterations}: ${elapsed.toFixed(2)}ms (${(iterations / elapsed * 1000).toFixed(0)} ops/sec)`);
}
