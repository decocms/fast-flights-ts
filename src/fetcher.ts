import type { FlightResults } from "./models.js";
import type { Query } from "./query.js";
import { parse } from "./parser.js";
import type { Integration } from "./integrations/base.js";

const URL = "https://www.google.com/travel/flights";

export async function getFlights(
  q: Query | string,
  opts: { proxy?: string; integration?: Integration } = {},
): Promise<FlightResults> {
  const html = await fetchFlightsHtml(q, opts);
  return parse(html);
}

export async function fetchFlightsHtml(
  q: Query | string,
  opts: { proxy?: string; integration?: Integration } = {},
): Promise<string> {
  if (opts.integration) {
    return opts.integration.fetchHtml(q);
  }

  let url: string;
  if (typeof q === "string") {
    url = `${URL}?q=${encodeURIComponent(q)}`;
  } else {
    const params = q.params();
    const qs = new URLSearchParams(params).toString();
    url = `${URL}?${qs}`;
  }

  // Try to use curl-impersonate via node-libcurl for TLS fingerprinting
  try {
    const { curly } = await import("node-libcurl");
    const result = await curly.get(url, {
      PROXY: opts.proxy || "",
      FOLLOWLOCATION: true,
      COOKIEFILE: "", // enable cookie engine
      REFERER: URL,
      USERAGENT:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    });
    return result.data as string;
  } catch {
    // Fallback to native fetch if node-libcurl is not available
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
        Referer: URL,
      },
    });
    return res.text();
  }
}
