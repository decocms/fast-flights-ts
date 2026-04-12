import type { FlightResults } from "./models.js";
import type { Query } from "./query.js";
import { parse } from "./parser.js";
import type { Integration } from "./integrations/base.js";
import { HttpError, CaptchaError, TimeoutError, FlightError } from "./errors.js";

const URL = "https://www.google.com/travel/flights";
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

function buildUrl(q: Query | string): string {
  if (typeof q === "string") return `${URL}?q=${encodeURIComponent(q)}`;
  const qs = new URLSearchParams(q.params()).toString();
  return `${URL}?${qs}`;
}

function isCaptcha(html: string): boolean {
  return html.includes("g-recaptcha") || html.includes('id="captcha"');
}

function checkResponse(html: string, status: number): void {
  if (status >= 400) {
    throw new HttpError(status, html.length);
  }
  if (isCaptcha(html)) {
    throw new CaptchaError(html.length);
  }
}

function isRetryable(err: unknown): boolean {
  if (err instanceof HttpError && RETRYABLE_STATUS.has(err.status)) return true;
  if (err instanceof HttpError) return false;
  if (err instanceof CaptchaError) return false;
  if (err instanceof TimeoutError) return true;
  // Network errors (ECONNRESET, ENOTFOUND, etc.)
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

async function fetchOnce(url: string, opts: FetchOptions): Promise<string> {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;

  // Try node-libcurl for TLS fingerprinting
  try {
    const { curly } = await import("node-libcurl");
    const result = await curly.get(url, {
      PROXY: opts.proxy || "",
      FOLLOWLOCATION: true,
      COOKIEFILE: "",
      REFERER: URL,
      USERAGENT: UA,
      CONNECTTIMEOUT: Math.ceil(timeout / 1000),
      TIMEOUT: Math.ceil(timeout / 1000),
    });
    const html = result.data as string;
    const status = result.statusCode as number;
    checkResponse(html, status);
    return html;
  } catch (err) {
    // Re-throw our own errors (HttpError, CaptchaError)
    if (err instanceof FlightError) throw err;
    // node-libcurl not available — fall through to fetch
  }

  // Fallback to native fetch
  const { signal, cleanup } = mergeSignals(timeout, opts.signal);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Referer: URL },
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

export async function fetchFlightsHtml(
  q: Query | string,
  opts: FetchOptions = {},
): Promise<string> {
  if (opts.integration) {
    return opts.integration.fetchHtml(q, opts);
  }

  const url = buildUrl(q);
  const maxRetries = opts.maxRetries ?? 0;
  const retryDelay = opts.retryDelay ?? DEFAULT_RETRY_DELAY;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (opts.debug && attempt > 0) {
        console.log(`[fast-flights] retry ${attempt}/${maxRetries}`);
      }
      return await fetchOnce(url, opts);
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

export async function getFlights(
  q: Query | string,
  opts: FetchOptions = {},
): Promise<FlightResults> {
  const html = await fetchFlightsHtml(q, opts);
  return parse(html);
}
