import { bench, describe } from "vitest";
import { encodeInfo, encodeInfoToBase64, Seat, Trip, Passenger } from "../src/protobuf.js";
import { createQuery, Passengers } from "../src/query.js";
import { parseJs, parsePayload, parseRpcResponse } from "../src/parser.js";

// --- Protobuf encoding benchmarks ---

const simpleInfo = {
  data: [
    { date: "2026-02-16", from_airport: "MYJ", to_airport: "TPE" },
  ],
  passengers: [Passenger.ADULT] as Passenger[],
  seat: Seat.ECONOMY as Seat,
  trip: Trip.ONE_WAY as Trip,
};

const complexInfo = {
  data: [
    {
      date: "2026-03-01",
      from_airport: "JFK",
      to_airport: "LAX",
      max_stops: 1,
      airlines: ["AA", "UA", "DL"],
    },
    {
      date: "2026-03-08",
      from_airport: "LAX",
      to_airport: "JFK",
      max_stops: 2,
      airlines: ["AA", "UA"],
    },
  ],
  passengers: [Passenger.ADULT, Passenger.ADULT, Passenger.CHILD] as Passenger[],
  seat: Seat.BUSINESS as Seat,
  trip: Trip.ROUND_TRIP as Trip,
};

describe("protobuf encoding", () => {
  bench("encodeInfo (simple)", () => {
    encodeInfo(simpleInfo);
  });

  bench("encodeInfo (complex)", () => {
    encodeInfo(complexInfo);
  });

  bench("encodeInfoToBase64 (simple)", () => {
    encodeInfoToBase64(simpleInfo);
  });

  bench("encodeInfoToBase64 (complex)", () => {
    encodeInfoToBase64(complexInfo);
  });
});

// --- Query building benchmarks ---

describe("query pipeline", () => {
  bench("createQuery (simple)", () => {
    createQuery({
      flights: [
        { date: "2026-02-16", from_airport: "MYJ", to_airport: "TPE" },
      ],
      seat: "economy",
      trip: "one-way",
      passengers: new Passengers({ adults: 1 }),
    });
  });

  bench("createQuery + toStr", () => {
    const q = createQuery({
      flights: [
        { date: "2026-02-16", from_airport: "MYJ", to_airport: "TPE" },
      ],
      seat: "economy",
      trip: "one-way",
      passengers: new Passengers({ adults: 1 }),
    });
    q.toStr();
  });

  bench("createQuery + url()", () => {
    const q = createQuery({
      flights: [
        { date: "2026-02-16", from_airport: "MYJ", to_airport: "TPE" },
      ],
      seat: "economy",
      trip: "one-way",
      passengers: new Passengers({ adults: 1 }),
      language: "en-US",
      currency: "USD",
    });
    q.url();
  });
});

// --- Parser benchmarks ---

function buildFlightEntry(price: number) {
  return [
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
    [[null, price]],
  ];
}

function buildMockPayload(numFlights: number): string {
  const flights = [];
  for (let i = 0; i < numFlights; i++) flights.push(buildFlightEntry(350 + i));

  const payload: any[] = [];
  payload[2] = [flights.slice(0, Math.min(3, numFlights))];
  payload[3] = [flights.slice(3)];
  payload[7] = [null, [
    [["*A", "Star Alliance"], ["OW", "Oneworld"]],
    [["JL", "Japan Airlines"], ["NH", "ANA"]],
  ]];

  return `data:${JSON.stringify(payload)},sideChannel`;
}

function buildMockRpcResponse(numFlights: number): string {
  const flights = [];
  for (let i = 0; i < numFlights; i++) flights.push(buildFlightEntry(350 + i));

  const payload: any[] = [];
  payload[2] = [flights.slice(0, Math.min(3, numFlights))];
  payload[3] = [flights.slice(3)];
  payload[7] = [null, [
    [["*A", "Star Alliance"], ["OW", "Oneworld"]],
    [["JL", "Japan Airlines"], ["NH", "ANA"]],
  ]];

  const inner = JSON.stringify(payload);
  const outer = JSON.stringify([[null, null, inner]]);
  return ")]}'\n" + outer;
}

const smallJs = buildMockPayload(5);
const mediumJs = buildMockPayload(50);
const largeJs = buildMockPayload(200);

const smallRpc = buildMockRpcResponse(5);
const mediumRpc = buildMockRpcResponse(50);
const largeRpc = buildMockRpcResponse(200);

describe("parseJs (HTML path)", () => {
  bench("5 flights", () => { parseJs(smallJs); });
  bench("50 flights", () => { parseJs(mediumJs); });
  bench("200 flights", () => { parseJs(largeJs); });
});

describe("parseRpcResponse (RPC path)", () => {
  bench("5 flights", () => { parseRpcResponse(smallRpc); });
  bench("50 flights", () => { parseRpcResponse(mediumRpc); });
  bench("200 flights", () => { parseRpcResponse(largeRpc); });
});
