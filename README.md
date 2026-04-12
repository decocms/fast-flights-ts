<div align="center">

# fast-flights-ts

Fast, strongly-typed Google Flights scraper for Node.js.
Zero-dependency core with hand-rolled protobuf encoding.

```bash
npm install fast-flights-ts
```

</div>

> Forked from [AWeirdDev/flights](https://github.com/AWeirdDev/flights) (Python).
> Ported to TypeScript by [Claude Opus 4.6](https://claude.ai).

## Quick start

```typescript
import { createQuery, Passengers, getFlights } from "fast-flights-ts";

const query = createQuery({
  flights: [
    {
      date: "2026-02-16",
      from_airport: "MYJ",
      to_airport: "TPE",
    },
  ],
  seat: "economy",
  trip: "one-way",
  passengers: new Passengers({ adults: 1 }),
  language: "zh-TW",
});

const results = await getFlights(query);

for (const flight of results) {
  console.log(
    flight.airlines.join(", "),
    `$${flight.price}`,
    flight.flights.map((f) => `${f.from_airport.code}->${f.to_airport.code}`).join(" "),
  );
}
```

## Integrations

### Bright Data

```typescript
import { getFlights } from "fast-flights-ts";
import { BrightData } from "fast-flights-ts";

const results = await getFlights(query, {
  integration: new BrightData({ api_key: "your-key" }),
});
```

Env vars: `BRIGHT_DATA_API_KEY`, `BRIGHT_DATA_API_URL`, `BRIGHT_DATA_SERP_ZONE`.

## API

### `createQuery(options)`

| Option | Type | Default |
|--------|------|---------|
| `flights` | `FlightQueryInput[]` | required |
| `seat` | `"economy" \| "premium-economy" \| "business" \| "first"` | `"economy"` |
| `trip` | `"round-trip" \| "one-way" \| "multi-city"` | `"one-way"` |
| `passengers` | `Passengers` | 1 adult |
| `language` | `Language \| ""` | `""` |
| `currency` | `Currency \| ""` | `""` |
| `max_stops` | `number \| null` | `null` |

### `getFlights(query, options?)`

Returns `Promise<FlightResults>` -- an array of `Flights` with attached `metadata`.

### `Passengers`

```typescript
new Passengers({ adults: 2, children: 1, infants_in_seat: 0, infants_on_lap: 0 })
```

Max 9 total. Infants on lap cannot exceed adult count.

## Response types

```typescript
interface Flights {
  type: string;
  price: number;
  airlines: string[];
  flights: SingleFlight[];
  carbon: CarbonEmission;
}

interface SingleFlight {
  from_airport: Airport; // { code, name }
  to_airport: Airport;
  departure: SimpleDatetime;
  arrival: SimpleDatetime;
  duration: number; // minutes
  plane_type: string;
}

interface FlightResults extends Array<Flights> {
  metadata: JsMetadata; // { airlines, alliances }
}
```

## Benchmarks

Compared against the original Python implementation (10,000 iterations).

### Encoding (query + protobuf + base64)

| | ops/sec | latency |
|-|---------|---------|
| Python | 215,851 | 4.6 us |
| **TypeScript** | **469,403** | **2.1 us** |

**2.2x faster.**

### Parsing (JSON extraction + flight mapping)

| | ops/sec | latency |
|-|---------|---------|
| Python | 17,282 | 57.9 us |
| **TypeScript** | **55,008** | **18.2 us** |

**3.2x faster.**

### Detailed breakdown (`npm run bench`)

| Operation | ops/sec | mean |
|-----------|---------|------|
| `encodeInfo` (simple) | 804,701 | 1.2 us |
| `encodeInfo` (complex) | 331,556 | 3.0 us |
| `encodeInfoToBase64` (simple) | 712,540 | 1.4 us |
| `createQuery` (simple) | 15,908,037 | 0.06 us |
| `createQuery` + `toStr()` | 667,147 | 1.5 us |
| `parseJs` (5 flights) | 193,346 | 5.2 us |
| `parseJs` (50 flights) | 23,748 | 42.1 us |
| `parseJs` (200 flights) | 5,863 | 170.5 us |

## How it works

1. **Query** -- builds a protobuf `Info` message from flight parameters
2. **Protobuf** -- hand-rolled binary encoder (~80 lines, no protobufjs) serializes to bytes
3. **Base64** -- encoded bytes become the `tfs` URL parameter
4. **Fetch** -- HTTP request with optional browser TLS fingerprinting via `node-libcurl`
5. **Parse** -- extracts embedded JS data from response HTML using `indexOf`/`slice` (no DOM parser)

### Why it's fast

- **Manual protobuf encoder** with pre-allocated `Uint8Array(512)`, zero intermediate allocations
- **No DOM parsing** -- raw string ops for HTML extraction
- **Plain object literals** from parser for V8 hidden class optimization
- **Zero runtime dependencies** -- `node-libcurl` is optional for TLS fingerprinting
- **10 KB** bundled (ESM + CJS dual output)

## Development

```bash
npm install
npm run typecheck
npm test
npm run bench
npm run build
```

## License

MIT -- see [LICENSE](LICENSE).

Original Python library by [AWeirdDev](https://github.com/AWeirdDev).
