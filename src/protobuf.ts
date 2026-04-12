// Manual protobuf encoder for flights.proto
// Zero dependencies, pre-allocated buffer, single-pass encoding.

const encoder = new TextEncoder();

// Wire types
const VARINT = 0;
const LEN = 2;

// Pre-computed tags: (fieldNumber << 3) | wireType
const TAG_AIRPORT_AIRPORT = (2 << 3) | LEN;       // 0x12
const TAG_FD_DATE = (2 << 3) | LEN;               // 0x12
const TAG_FD_MAX_STOPS = (5 << 3) | VARINT;       // 0x28
const TAG_FD_AIRLINES = (6 << 3) | LEN;           // 0x32
const TAG_FD_FROM = (13 << 3) | LEN;              // 0x6a
const TAG_FD_TO = (14 << 3) | LEN;                // 0x72
const TAG_INFO_DATA = (3 << 3) | LEN;             // 0x1a
const TAG_INFO_PASSENGERS_PACKED = (8 << 3) | LEN; // 0x42 (packed repeated)
const TAG_INFO_SEAT = (9 << 3) | VARINT;          // 0x48
// Field 19 needs 2-byte varint tag: (19 << 3) | 0 = 152 = 0x98 → varint [0x98, 0x01]
const TAG_INFO_TRIP_B0 = 0x98;
const TAG_INFO_TRIP_B1 = 0x01;

export function writeVarint(buf: Uint8Array, offset: number, value: number): number {
  while (value > 0x7f) {
    buf[offset++] = (value & 0x7f) | 0x80;
    value >>>= 7;
  }
  buf[offset++] = value;
  return offset;
}

function writeBytes(buf: Uint8Array, offset: number, data: Uint8Array): number {
  buf.set(data, offset);
  return offset + data.length;
}

function writeString(buf: Uint8Array, offset: number, tag: number, str: string): number {
  const encoded = encoder.encode(str);
  buf[offset++] = tag;
  offset = writeVarint(buf, offset, encoded.length);
  return writeBytes(buf, offset, encoded);
}

function encodeAirport(buf: Uint8Array, offset: number, airport: string): number {
  const encoded = encoder.encode(airport);
  // field 2, length-delimited
  buf[offset++] = TAG_AIRPORT_AIRPORT;
  offset = writeVarint(buf, offset, encoded.length);
  return writeBytes(buf, offset, encoded);
}

// Encode to temp buffer, return slice
function encodeAirportMsg(airport: string): Uint8Array {
  const tmp = new Uint8Array(64);
  const len = encodeAirport(tmp, 0, airport);
  return tmp.subarray(0, len);
}

export interface FlightDataInput {
  date: string;
  from_airport: string;
  to_airport: string;
  max_stops?: number | null;
  airlines?: string[] | null;
}

function encodeFlightData(buf: Uint8Array, offset: number, fd: FlightDataInput): number {
  // field 2: date
  offset = writeString(buf, offset, TAG_FD_DATE, fd.date);

  // field 5: max_stops (optional)
  if (fd.max_stops != null) {
    buf[offset++] = TAG_FD_MAX_STOPS;
    offset = writeVarint(buf, offset, fd.max_stops);
  }

  // field 6: airlines (repeated)
  if (fd.airlines) {
    for (const airline of fd.airlines) {
      offset = writeString(buf, offset, TAG_FD_AIRLINES, airline);
    }
  }

  // field 13: from_airport (submessage)
  const fromMsg = encodeAirportMsg(fd.from_airport);
  buf[offset++] = TAG_FD_FROM;
  offset = writeVarint(buf, offset, fromMsg.length);
  offset = writeBytes(buf, offset, fromMsg);

  // field 14: to_airport (submessage)
  const toMsg = encodeAirportMsg(fd.to_airport);
  buf[offset++] = TAG_FD_TO;
  offset = writeVarint(buf, offset, toMsg.length);
  return writeBytes(buf, offset, toMsg);
}

export const enum Seat {
  ECONOMY = 1,
  PREMIUM_ECONOMY = 2,
  BUSINESS = 3,
  FIRST = 4,
}

export const enum Trip {
  ROUND_TRIP = 1,
  ONE_WAY = 2,
  MULTI_CITY = 3,
}

export const enum Passenger {
  ADULT = 1,
  CHILD = 2,
  INFANT_IN_SEAT = 3,
  INFANT_ON_LAP = 4,
}

export interface InfoInput {
  data: FlightDataInput[];
  seat: Seat;
  passengers: Passenger[];
  trip: Trip;
}

export function encodeInfo(info: InfoInput): Uint8Array {
  const buf = new Uint8Array(512);
  let offset = 0;

  // field 3: repeated FlightData (submessages)
  for (const fd of info.data) {
    const tmp = new Uint8Array(256);
    const fdLen = encodeFlightData(tmp, 0, fd);
    buf[offset++] = TAG_INFO_DATA;
    offset = writeVarint(buf, offset, fdLen);
    offset = writeBytes(buf, offset, tmp.subarray(0, fdLen));
  }

  // field 8: repeated Passenger (packed varint - proto3 default)
  if (info.passengers.length > 0) {
    buf[offset++] = TAG_INFO_PASSENGERS_PACKED;
    // Encode packed payload to temp buffer to get length
    const packedTmp = new Uint8Array(info.passengers.length * 2);
    let packedLen = 0;
    for (const p of info.passengers) {
      packedLen = writeVarint(packedTmp, packedLen, p);
    }
    offset = writeVarint(buf, offset, packedLen);
    offset = writeBytes(buf, offset, packedTmp.subarray(0, packedLen));
  }

  // field 9: seat (varint)
  buf[offset++] = TAG_INFO_SEAT;
  offset = writeVarint(buf, offset, info.seat);

  // field 19: trip (2-byte tag, then varint value)
  buf[offset++] = TAG_INFO_TRIP_B0;
  buf[offset++] = TAG_INFO_TRIP_B1;
  offset = writeVarint(buf, offset, info.trip);

  return buf.subarray(0, offset);
}

export function encodeInfoToBase64(info: InfoInput): string {
  const bytes = encodeInfo(info);
  return Buffer.from(bytes).toString("base64");
}
