export interface Airline {
  readonly code: string;
  readonly name: string;
}

export interface Alliance {
  readonly code: string;
  readonly name: string;
}

export interface JsMetadata {
  readonly airlines: readonly Airline[];
  readonly alliances: readonly Alliance[];
}

export interface Airport {
  readonly name: string;
  readonly code: string;
}

export interface SimpleDatetime {
  readonly date: readonly [number, number, number];
  readonly time: readonly [number, number];
}

export interface SingleFlight {
  readonly from_airport: Airport;
  readonly to_airport: Airport;
  readonly departure: SimpleDatetime;
  readonly arrival: SimpleDatetime;
  /** Duration in minutes */
  readonly duration: number;
  readonly plane_type: string;
}

export interface CarbonEmission {
  /** Grams */
  readonly typical_on_route: number;
  /** Grams */
  readonly emission: number;
}

export interface Flights {
  readonly type: string;
  readonly price: number;
  readonly airlines: readonly string[];
  readonly flights: readonly SingleFlight[];
  readonly carbon: CarbonEmission;
}

export interface FlightResults extends Array<Flights> {
  metadata: JsMetadata;
}
