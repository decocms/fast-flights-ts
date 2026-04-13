import type { FlightResults } from "./models.js";
import { Query } from "./query.js";
import { parse, parseRpcResponse } from "./parser.js";
import type { Integration } from "./integrations/base.js";
import { HttpError, CaptchaError, TimeoutError, FlightError } from "./errors.js";

const FLIGHTS_URL = "https://www.google.com/travel/flights";
const RPC_URL = "https://www.google.com/_/FlightsFrontendUi/data/travel.frontend.flights.FlightsFrontendService/GetShoppingResults";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRY_DELAY = 1_000;
const RETRYABLE_STATUS = new Set([429, 503, 502, 504]);


export interface FetchOptions {
  proxy?: string;
  integration?: Integration;
  timeout?: number;
  signal?: AbortSignal;
  maxRetries?: number;
  retryDelay?: number;
  debug?: boolean;
}

function isCaptcha(html: string): boolean {
  return html.includes("g-recaptcha") || html.includes('id="captcha"');
}

function checkResponse(html: string, status: number): void {
  if (status >= 400) throw new HttpError(status, html.length);
  if (isCaptcha(html)) throw new CaptchaError(html.length);
}

function isRetryable(err: unknown): boolean {
  if (err instanceof HttpError && RETRYABLE_STATUS.has(err.status)) return true;
  if (err instanceof HttpError) return false;
  if (err instanceof CaptchaError) return false;
  if (err instanceof TimeoutError) return true;
  if (err instanceof TypeError) return true;
  return false;
}

function jitteredDelay(base: number, attempt: number): number {
  const exp = base * Math.pow(2, attempt);
  return exp + Math.random() * exp * 0.25;
}

function mergeSignals(timeout: number, external?: AbortSignal): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new TimeoutError(timeout)), timeout);
  const onExternal = () => controller.abort(external!.reason);
  if (external) {
    if (external.aborted) { controller.abort(external.reason); }
    else { external.addEventListener("abort", onExternal, { once: true }); }
  }
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      external?.removeEventListener("abort", onExternal);
    },
  };
}

// --- RPC-based fetching (primary path) ---

function buildRpcSegment(fd: { date: string; from_airport: string; to_airport: string; max_stops?: number | null; airlines?: string[] | null }) {
  return [
    [[[fd.from_airport, 0]]],
    [[[fd.to_airport, 0]]],
    null,
    fd.max_stops != null ? fd.max_stops + 1 : 0,
    fd.airlines ?? null,
    null,
    fd.date,
    null, null, null, null, null, null, null,
    3,
  ];
}

function buildRpcPayload(q: Query): string {
  const segments = q.flightData.map(buildRpcSegment);
  const tripType = q.trip || 2;
  const seatType = q.seat || 1;

  // Count passengers by type from the protobuf enum values
  const pax = [0, 0, 0, 0]; // adults, children, infants_in_seat, infants_on_lap
  for (const p of q.passengers) {
    if (p >= 1 && p <= 4) pax[p - 1]++;
  }

  const filters = [
    [],
    [
      null, null,
      tripType,
      null, [],
      seatType,
      pax,
      null, null, null, null, null, null,
      segments,
      null, null, null,
      1,
      null, null, null, null, null, null, null, null, null, null,
      null,
    ],
    1, 0, 0, 2,
  ];

  const filtersJson = JSON.stringify(filters);
  const wrapped = JSON.stringify([null, filtersJson]);
  return `f.req=${encodeURIComponent(wrapped)}`;
}

function buildRpcUrl(q: Query): string {
  const params = new URLSearchParams();
  if (q.language) params.set("hl", q.language);
  if (q.currency) params.set("curr", q.currency);
  const qs = params.toString();
  return qs ? `${RPC_URL}?${qs}` : RPC_URL;
}

async function fetchRpcOnce(q: Query, opts: FetchOptions): Promise<string> {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
  const body = buildRpcPayload(q);
  const url = buildRpcUrl(q);
  const { signal, cleanup } = mergeSignals(timeout, opts.signal);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": UA,
        Referer: "https://www.google.com/travel/flights/search",
        Origin: "https://www.google.com",
      },
      body,
      signal,
    });
    const text = await res.text();
    if (!res.ok) throw new HttpError(res.status, text.length);
    return text;
  } catch (err) {
    if (signal.aborted && signal.reason instanceof TimeoutError) throw signal.reason;
    throw err;
  } finally {
    cleanup();
  }
}

// --- HTML-based fetching (fallback for string queries / integrations) ---

function buildHtmlUrl(q: Query | string): string {
  if (typeof q === "string") return `${FLIGHTS_URL}?q=${encodeURIComponent(q)}`;
  const qs = new URLSearchParams(q.params()).toString();
  return `${FLIGHTS_URL}?${qs}`;
}

async function fetchHtmlOnce(url: string, opts: FetchOptions): Promise<string> {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;

  try {
    const { curly } = await import("node-libcurl");
    const result = await curly.get(url, {
      PROXY: opts.proxy || "",
      FOLLOWLOCATION: true,
      COOKIEFILE: "",
      REFERER: FLIGHTS_URL,
      USERAGENT: UA,
      CONNECTTIMEOUT: Math.ceil(timeout / 1000),
      TIMEOUT: Math.ceil(timeout / 1000),
    });
    const html = result.data as string;
    checkResponse(html, result.statusCode as number);
    return html;
  } catch (err) {
    if (err instanceof FlightError) throw err;
  }

  const { signal, cleanup } = mergeSignals(timeout, opts.signal);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Referer: FLIGHTS_URL },
      signal,
    });
    const html = await res.text();
    checkResponse(html, res.status);
    return html;
  } catch (err) {
    if (signal.aborted && signal.reason instanceof TimeoutError) throw signal.reason;
    throw err;
  } finally {
    cleanup();
  }
}

// --- Retry wrapper ---

async function withRetry<T>(fn: () => Promise<T>, opts: FetchOptions): Promise<T> {
  const maxRetries = opts.maxRetries ?? 0;
  const retryDelay = opts.retryDelay ?? DEFAULT_RETRY_DELAY;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (opts.debug && attempt > 0) {
        console.log(`[fast-flights] retry ${attempt}/${maxRetries}`);
      }
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries && isRetryable(err)) {
        const delay = jitteredDelay(retryDelay, attempt);
        if (opts.debug) {
          console.log(`[fast-flights] ${err instanceof Error ? err.message : err} — retrying in ${Math.round(delay)}ms`);
        }
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// --- Public API ---

export async function fetchFlightsHtml(
  q: Query | string,
  opts: FetchOptions = {},
): Promise<string> {
  if (opts.integration) {
    return opts.integration.fetchHtml(q, opts);
  }
  const url = buildHtmlUrl(q);
  return withRetry(() => fetchHtmlOnce(url, opts), opts);
}

export async function getFlights(
  q: Query | string,
  opts: FetchOptions = {},
): Promise<FlightResults> {
  // Use RPC for structured queries (faster, works for multi-city)
  if (q instanceof Query && !opts.integration) {
    if (opts.debug) console.log("[fast-flights] using RPC endpoint");
    return withRetry(async () => {
      const text = await fetchRpcOnce(q, opts);
      return parseRpcResponse(text);
    }, opts);
  }

  // Fall back to HTML scraping for string queries or integrations
  const html = await fetchFlightsHtml(q, opts);
  return parse(html);
}
