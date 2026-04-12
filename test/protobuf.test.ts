import { describe, it, expect } from "vitest";
import { encodeInfo, encodeInfoToBase64, Seat, Trip, Passenger } from "../src/protobuf.js";

describe("protobuf encoder", () => {
  it("encodes a simple one-way query matching Python output byte-for-byte", () => {
    const info = {
      data: [
        {
          date: "2026-02-16",
          from_airport: "MYJ",
          to_airport: "TPE",
        },
      ],
      passengers: [Passenger.ADULT],
      seat: Seat.ECONOMY,
      trip: Trip.ONE_WAY,
    };

    const base64 = encodeInfoToBase64(info);
    expect(base64).toBe("GhoSCjIwMjYtMDItMTZqBRIDTVlKcgUSA1RQRUIBAUgBmAEC");

    const bytes = encodeInfo(info);
    const expected = new Uint8Array([
      26, 26, 18, 10, 50, 48, 50, 54, 45, 48, 50, 45, 49, 54, 106, 5, 18, 3,
      77, 89, 74, 114, 5, 18, 3, 84, 80, 69, 66, 1, 1, 72, 1, 152, 1, 2,
    ]);
    expect(Array.from(bytes)).toEqual(Array.from(expected));
  });

  it("encodes with max_stops and airlines", () => {
    const info = {
      data: [
        {
          date: "2026-03-01",
          from_airport: "JFK",
          to_airport: "LAX",
          max_stops: 1,
          airlines: ["AA", "UA"],
        },
      ],
      passengers: [Passenger.ADULT, Passenger.ADULT],
      seat: Seat.BUSINESS,
      trip: Trip.ROUND_TRIP,
    };

    const bytes = encodeInfo(info);
    // Verify it doesn't throw and produces non-empty output
    expect(bytes.length).toBeGreaterThan(0);

    // Verify base64 round-trip
    const b64 = encodeInfoToBase64(info);
    expect(Buffer.from(b64, "base64")).toEqual(Buffer.from(bytes));
  });

  it("encodes multiple passengers", () => {
    const info = {
      data: [
        {
          date: "2026-01-01",
          from_airport: "SFO",
          to_airport: "NRT",
        },
      ],
      passengers: [Passenger.ADULT, Passenger.CHILD, Passenger.INFANT_ON_LAP],
      seat: Seat.PREMIUM_ECONOMY,
      trip: Trip.ONE_WAY,
    };

    const bytes = encodeInfo(info);
    expect(bytes.length).toBeGreaterThan(0);
  });
});
