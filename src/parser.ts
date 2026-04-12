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

export function parse(html: string): FlightResults {
  // Find <script class="ds:1" ...> — there may be other attributes (e.g. nonce) before >
  const classMarker = 'class="ds:1"';
  const classIdx = html.indexOf(classMarker);
  if (classIdx === -1) throw new Error('Could not find script tag with class="ds:1"');
  const tagClose = html.indexOf(">", classIdx + classMarker.length);
  if (tagClose === -1) throw new Error("Could not find closing > for ds:1 script tag");
  const contentStart = tagClose + 1;
  const end = html.indexOf("</script>", contentStart);
  if (end === -1) throw new Error("Could not find closing </script> tag");
  return parseJs(html.slice(contentStart, end));
}

export function parseJs(js: string): FlightResults {
  // Equivalent to: js.split("data:", 1)[1].rsplit(",", 1)[0]
  const dataIdx = js.indexOf("data:");
  if (dataIdx === -1) throw new Error('Could not find "data:" in script content');
  const afterData = dataIdx + 5;
  const lastComma = js.lastIndexOf(",");
  const data = js.slice(afterData, lastComma);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any[] = JSON.parse(data);

  // Extract alliances and airlines metadata
  const [alliancesData, airlinesData] = payload[7][1] as [
    [string, string][],
    [string, string][],
  ];

  const alliances: Alliance[] = alliancesData.map(([code, name]) => ({ code, name }));
  const airlines: Airline[] = airlinesData.map(([code, name]) => ({ code, name }));
  const metadata: JsMetadata = { alliances, airlines };

  const flights: Flights[] = [];

  if (payload[3][0] == null) {
    return Object.assign(flights, { metadata }) as FlightResults;
  }

  for (const k of payload[3][0]) {
    const flight = k[0];
    const price: number = k[1][0][1];
    const typ: string = flight[0];
    const airlineNames: string[] = flight[1];

    const sgFlights: SingleFlight[] = [];

    for (const sf of flight[2]) {
      const fromAirport: Airport = { code: sf[3], name: sf[4] };
      const toAirport: Airport = { code: sf[6], name: sf[5] };
      const depTime = sf[8];
      const arrTime = sf[10];
      const departure: SimpleDatetime = { date: sf[20], time: [depTime[0], depTime[1] ?? 0] };
      const arrival: SimpleDatetime = { date: sf[21], time: [arrTime[0], arrTime[1] ?? 0] };
      const planeType: string = sf[17];
      const duration: number = sf[11];

      sgFlights.push({
        from_airport: fromAirport,
        to_airport: toAirport,
        departure,
        arrival,
        duration,
        plane_type: planeType,
      });
    }

    const extras = flight[22];
    const carbonEmission: number = extras[7];
    const typicalCarbonEmission: number = extras[8];

    flights.push({
      type: typ,
      price,
      airlines: airlineNames,
      flights: sgFlights,
      carbon: {
        emission: carbonEmission,
        typical_on_route: typicalCarbonEmission,
      } as CarbonEmission,
    });
  }

  return Object.assign(flights, { metadata }) as FlightResults;
}
