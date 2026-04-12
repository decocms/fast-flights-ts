import {
  encodeInfo,
  encodeInfoToBase64,
  Seat,
  Trip,
  Passenger,
  type FlightDataInput,
  type InfoInput,
} from "./protobuf.js";
import type { SeatType, TripType, Language, Currency } from "./types.js";

const BASE_URL = "https://www.google.com/travel/flights";
const SEARCH_URL = `${BASE_URL}/search`;

const SEAT_LOOKUP: Record<SeatType, Seat> = {
  economy: Seat.ECONOMY,
  "premium-economy": Seat.PREMIUM_ECONOMY,
  business: Seat.BUSINESS,
  first: Seat.FIRST,
};

const TRIP_LOOKUP: Record<TripType, Trip> = {
  "round-trip": Trip.ROUND_TRIP,
  "one-way": Trip.ONE_WAY,
  "multi-city": Trip.MULTI_CITY,
};

export interface FlightQueryInput {
  date: string | Date;
  from_airport: string;
  to_airport: string;
  max_stops?: number | null;
  airlines?: string[] | null;
}

export class Passengers {
  readonly adults: number;
  readonly children: number;
  readonly infants_in_seat: number;
  readonly infants_on_lap: number;

  constructor(opts: {
    adults?: number;
    children?: number;
    infants_in_seat?: number;
    infants_on_lap?: number;
  } = {}) {
    this.adults = opts.adults ?? 0;
    this.children = opts.children ?? 0;
    this.infants_in_seat = opts.infants_in_seat ?? 0;
    this.infants_on_lap = opts.infants_on_lap ?? 0;

    const total = this.adults + this.children + this.infants_in_seat + this.infants_on_lap;
    if (total > 9) throw new Error("Too many passengers (> 9)");
    if (this.infants_on_lap > this.adults) {
      throw new Error("Must have at least one adult per infant on lap");
    }
  }

  toPb(): Passenger[] {
    const result: Passenger[] = [];
    for (let i = 0; i < this.adults; i++) result.push(Passenger.ADULT);
    for (let i = 0; i < this.children; i++) result.push(Passenger.CHILD);
    for (let i = 0; i < this.infants_in_seat; i++) result.push(Passenger.INFANT_IN_SEAT);
    for (let i = 0; i < this.infants_on_lap; i++) result.push(Passenger.INFANT_ON_LAP);
    return result;
  }
}

const DEFAULT_PASSENGERS = new Passengers({ adults: 1 });

function formatDate(date: string | Date): string {
  if (typeof date === "string") return date;
  return date.toISOString().slice(0, 10);
}

function toFlightData(fq: FlightQueryInput, maxStops?: number | null): FlightDataInput {
  return {
    date: formatDate(fq.date),
    from_airport: fq.from_airport,
    to_airport: fq.to_airport,
    max_stops: fq.max_stops ?? maxStops,
    airlines: fq.airlines,
  };
}

export class Query {
  readonly flightData: FlightDataInput[];
  readonly seat: Seat;
  readonly trip: Trip;
  readonly passengers: Passenger[];
  readonly language: string;
  readonly currency: string;

  constructor(
    flightData: FlightDataInput[],
    seat: Seat,
    trip: Trip,
    passengers: Passenger[],
    language: string,
    currency: string,
  ) {
    this.flightData = flightData;
    this.seat = seat;
    this.trip = trip;
    this.passengers = passengers;
    this.language = language;
    this.currency = currency;
  }

  toInfo(): InfoInput {
    return {
      data: this.flightData,
      seat: this.seat,
      passengers: this.passengers,
      trip: this.trip,
    };
  }

  toBytes(): Uint8Array {
    return encodeInfo(this.toInfo());
  }

  toStr(): string {
    return encodeInfoToBase64(this.toInfo());
  }

  url(): string {
    return `${SEARCH_URL}?tfs=${this.toStr()}&hl=${this.language}&curr=${this.currency}`;
  }

  params(): Record<string, string> {
    return { tfs: this.toStr(), hl: this.language, curr: this.currency };
  }
}

export function createQuery(opts: {
  flights: FlightQueryInput[];
  seat?: SeatType;
  trip?: TripType;
  passengers?: Passengers;
  language?: string | Language;
  currency?: string | Currency;
  max_stops?: number | null;
}): Query {
  const passengers = opts.passengers ?? DEFAULT_PASSENGERS;
  return new Query(
    opts.flights.map((f) => toFlightData(f, opts.max_stops)),
    SEAT_LOOKUP[opts.seat ?? "economy"],
    TRIP_LOOKUP[opts.trip ?? "one-way"],
    passengers.toPb(),
    opts.language ?? "",
    opts.currency ?? "",
  );
}

export { BASE_URL };
