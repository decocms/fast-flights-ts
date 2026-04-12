import type {
  Airport,
  Airline,
  Alliance,
  CarbonEmission,
  Flights,
  FlightResults,
  JsMetadata,
  SimpleDatetime,
  SingleFlight,
} from "./models.js";
import { ParseError } from "./errors.js";

function makeResults(flights: Flights[], metadata: JsMetadata): FlightResults {
  return Object.assign(flights, { metadata }) as FlightResults;
}

export function parse(html: string): FlightResults {
  // Find <script class="ds:1" ...> — there may be other attributes (e.g. nonce) before >
  const classMarker = 'class="ds:1"';
  const classIdx = html.indexOf(classMarker);
  if (classIdx === -1) {
    // Detect common error pages
    if (html.includes("g-recaptcha") || html.includes('id="captcha"')) {
      throw new ParseError("Got a CAPTCHA page instead of flight results");
    }
    if (html.includes("errorHasStatus")) {
      throw new ParseError("Google returned an error response");
    }
    throw new ParseError(
      `Could not find flight data (no script tag with class="ds:1"). Response length: ${html.length}`,
    );
  }
  const tagClose = html.indexOf(">", classIdx + classMarker.length);
  if (tagClose === -1) throw new ParseError("Malformed HTML: unclosed ds:1 script tag");
  const contentStart = tagClose + 1;
  const end = html.indexOf("</script>", contentStart);
  if (end === -1) throw new ParseError("Malformed HTML: missing </script> for ds:1");
  return parseJs(html.slice(contentStart, end));
}

export function parseJs(js: string): FlightResults {
  const dataIdx = js.indexOf("data:");
  if (dataIdx === -1) throw new ParseError('Could not find "data:" in script content');
  const afterData = dataIdx + 5;
  const lastComma = js.lastIndexOf(",");
  if (lastComma <= afterData) throw new ParseError("Malformed data payload: no trailing comma");
  const data = js.slice(afterData, lastComma);

  let payload: any[];
  try {
    payload = JSON.parse(data);
  } catch (e) {
    throw new ParseError(`Failed to parse flight data JSON: ${(e as Error).message}`);
  }

  // Validate payload structure
  if (!Array.isArray(payload)) {
    throw new ParseError("Unexpected payload format: not an array");
  }

  // Extract metadata with validation
  const metaRoot = payload[7];
  let alliances: Alliance[] = [];
  let airlines: Airline[] = [];

  if (Array.isArray(metaRoot?.[1])) {
    const [alliancesData, airlinesData] = metaRoot[1] as [
      [string, string][] | undefined,
      [string, string][] | undefined,
    ];
    if (Array.isArray(alliancesData)) {
      alliances = alliancesData.map(([code, name]) => ({ code, name }));
    }
    if (Array.isArray(airlinesData)) {
      airlines = airlinesData.map(([code, name]) => ({ code, name }));
    }
  }

  const metadata: JsMetadata = { alliances, airlines };
  const flights: Flights[] = [];

  // No results
  if (!Array.isArray(payload[3]?.[0])) {
    return makeResults(flights, metadata);
  }

  for (const k of payload[3][0]) {
    try {
      const flight = k?.[0];
      if (!flight) continue;

      const price: number = k[1]?.[0]?.[1] ?? 0;
      const typ: string = flight[0] ?? "";
      const airlineNames: string[] = flight[1] ?? [];

      const sgFlights: SingleFlight[] = [];

      if (Array.isArray(flight[2])) {
        for (const sf of flight[2]) {
          if (!sf) continue;
          const fromAirport: Airport = { code: sf[3] ?? "", name: sf[4] ?? "" };
          const toAirport: Airport = { code: sf[6] ?? "", name: sf[5] ?? "" };
          const depTime = sf[8];
          const arrTime = sf[10];
          const departure: SimpleDatetime = {
            date: sf[20] ?? [0, 0, 0],
            time: [depTime?.[0] ?? 0, depTime?.[1] ?? 0],
          };
          const arrival: SimpleDatetime = {
            date: sf[21] ?? [0, 0, 0],
            time: [arrTime?.[0] ?? 0, arrTime?.[1] ?? 0],
          };

          sgFlights.push({
            from_airport: fromAirport,
            to_airport: toAirport,
            departure,
            arrival,
            duration: sf[11] ?? 0,
            plane_type: sf[17] ?? "",
          });
        }
      }

      const extras = flight[22];
      const carbon: CarbonEmission = {
        emission: extras?.[7] ?? 0,
        typical_on_route: extras?.[8] ?? 0,
      };

      flights.push({
        type: typ,
        price,
        airlines: airlineNames,
        flights: sgFlights,
        carbon,
      });
    } catch {
      // Skip malformed flight entries — don't crash the whole batch
      continue;
    }
  }

  return makeResults(flights, metadata);
}
