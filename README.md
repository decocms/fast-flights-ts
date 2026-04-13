<div align="center">

# fast-flights-ts

Fast, strongly-typed Google Flights scraper for Node.js.
Calls Google's internal RPC endpoint directly -- no HTML scraping, no browser required.

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
    { date: "2026-05-25", from_airport: "GIG", to_airport: "SFO" },
  ],
  seat: "economy",
  trip: "one-way",
  passengers: new Passengers({ adults: 1 }),
  currency: "USD",
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

## Multi-city

Multi-city and open-jaw queries work out of the box:

```typescript
const query = createQuery({
  flights: [
    { date: "2026-05-21", from_airport: "GIG", to_airport: "LAX" },
    { date: "2026-05-28", from_airport: "SFO", to_airport: "GIG" },
  ],
  seat: "business",
  trip: "multi-city",
  passengers: new Passengers({ adults: 1 }),
});

const results = await getFlights(query);
```

## Options

`getFlights` and `fetchFlightsHtml` accept a second argument:

```typescript
const results = await getFlights(query, {
  timeout: 15_000,       // ms, default 30s
  maxRetries: 3,         // retry on 429/503/timeout, default 0
  retryDelay: 2_000,     // base delay with exponential backoff + jitter
  signal: controller.signal, // external AbortSignal
  debug: true,           // log to console
});
```

## Integrations

### Bright Data

When using an integration, the library falls back to HTML scraping:

```typescript
import { getFlights, BrightData } from "fast-flights-ts";

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

## Error handling

All errors extend `FlightError`:

```typescript
import { FlightError, HttpError, CaptchaError, TimeoutError, ParseError } from "fast-flights-ts";

try {
  await getFlights(query);
} catch (e) {
  if (e instanceof TimeoutError) { /* request timed out */ }
  if (e instanceof HttpError) { /* e.status, e.responseLength */ }
  if (e instanceof CaptchaError) { /* Google wants a CAPTCHA */ }
  if (e instanceof ParseError) { /* unexpected response format */ }
}
```

Retry is automatic for 429, 502, 503, 504, and timeouts when `maxRetries > 0`.

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

### Encoding (query + protobuf + base64)

| | ops/sec | latency |
|-|---------|---------|
| Python | 215,851 | 4.6 us |
| **TypeScript** | **728,724** | **1.4 us** |

**3.4x faster.**

### Parsing

| Operation | ops/sec | mean |
|-----------|---------|------|
| `parseRpcResponse` (5 flights) | 151,354 | 6.6 us |
| `parseRpcResponse` (50 flights) | 17,604 | 56.8 us |
| `parseRpcResponse` (200 flights) | 4,368 | 229 us |
| `parseJs` (5 flights) | 185,223 | 5.4 us |
| `parseJs` (50 flights) | 23,234 | 43.0 us |
| `parseJs` (200 flights) | 5,792 | 172.6 us |

### Full breakdown (`npm run bench`)

| Operation | ops/sec | mean |
|-----------|---------|------|
| `encodeInfo` (simple) | 833,718 | 1.2 us |
| `encodeInfo` (complex) | 341,613 | 2.9 us |
| `encodeInfoToBase64` | 768,435 | 1.3 us |
| `createQuery` | 16,330,189 | 0.06 us |
| `createQuery` + `toStr()` | 728,724 | 1.4 us |

## How it works

1. **Query** -- builds flight parameters (dates, airports, seat, passengers)
2. **RPC** -- POSTs directly to Google's `GetShoppingResults` endpoint
3. **Parse** -- strips `)]}'` prefix, extracts nested JSON with flight data
4. **Fallback** -- HTML scraping via `node-libcurl` or `fetch` when using integrations

The RPC approach is used by default for structured queries. It works for all trip types (one-way, round-trip, multi-city) and returns more results than HTML scraping (best + other flights).

### Why it's fast

- **Direct RPC** -- no HTML to download or parse, ~35KB response vs ~2MB HTML
- **Manual protobuf encoder** (~80 lines, no protobufjs)
- **Zero runtime dependencies** -- `node-libcurl` is optional
- **20 KB** bundled (ESM + CJS dual output)

## Development

```bash
npm install
npm run typecheck
npm test            # 21 tests
npm run bench
npm run build
```

## License

MIT -- see [LICENSE](LICENSE).

Original Python library by [AWeirdDev](https://github.com/AWeirdDev).
RPC approach inspired by [swoop](https://github.com/saraswatayu/swoop).
