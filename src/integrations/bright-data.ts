import type { Query } from "../query.js";
import { BASE_URL } from "../query.js";
import { Integration, getEnv, type IntegrationOptions } from "./base.js";
import { HttpError, CaptchaError, TimeoutError } from "../errors.js";

const DEFAULT_API_URL = "https://api.brightdata.com/request";
const DEFAULT_DATA_SERP_ZONE = "serp_api1";
const DEFAULT_TIMEOUT = 30_000;

export class BrightData extends Integration {
  private readonly apiUrl: string;
  private readonly zone: string;
  private readonly apiKey: string;

  constructor(opts: {
    api_key?: string;
    api_url?: string;
    zone?: string;
  } = {}) {
    super();
    this.apiUrl = opts.api_url || process.env.BRIGHT_DATA_API_URL || DEFAULT_API_URL;
    this.zone = opts.zone || process.env.BRIGHT_DATA_SERP_ZONE || DEFAULT_DATA_SERP_ZONE;
    this.apiKey = opts.api_key || getEnv("BRIGHT_DATA_API_KEY");
  }

  async fetchHtml(q: Query | string, opts: IntegrationOptions = {}): Promise<string> {
    const url = typeof q === "string"
      ? `${BASE_URL}?q=${encodeURIComponent(q)}`
      : q.url();

    const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new TimeoutError(timeout)), timeout);

    const onExternal = () => controller.abort(opts.signal!.reason);
    if (opts.signal) {
      if (opts.signal.aborted) { controller.abort(opts.signal.reason); }
      else { opts.signal.addEventListener("abort", onExternal, { once: true }); }
    }

    try {
      const res = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ url, zone: this.zone }),
        signal: controller.signal,
      });

      const html = await res.text();

      if (!res.ok) {
        throw new HttpError(res.status, html.length, `BrightData API error: HTTP ${res.status}`);
      }
      if (html.includes("g-recaptcha") || html.includes('id="captcha"')) {
        throw new CaptchaError(html.length);
      }

      return html;
    } catch (err) {
      if (controller.signal.aborted && controller.signal.reason instanceof TimeoutError) {
        throw controller.signal.reason;
      }
      throw err;
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onExternal);
    }
  }
}
