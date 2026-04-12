export { createQuery, Query, Passengers, type FlightQueryInput } from "./query.js";
export { getFlights, fetchFlightsHtml } from "./fetcher.js";
export { parse, parseJs } from "./parser.js";
export { Integration } from "./integrations/base.js";
export { BrightData } from "./integrations/bright-data.js";
export type {
  Airline,
  Alliance,
  Airport,
  CarbonEmission,
  Flights,
  FlightResults,
  JsMetadata,
  SimpleDatetime,
  SingleFlight,
} from "./models.js";
export type { Language, Currency, SeatType, TripType } from "./types.js";
