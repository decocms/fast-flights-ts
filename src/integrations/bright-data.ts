import type { Query } from "../query.js";
import { BASE_URL } from "../query.js";
import { Integration, getEnv } from "./base.js";

const DEFAULT_API_URL = "https://api.brightdata.com/request";
const DEFAULT_DATA_SERP_ZONE = "serp_api1";

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

  async fetchHtml(q: Query | string): Promise<string> {
    const url = typeof q === "string"
      ? `${BASE_URL}?q=${encodeURIComponent(q)}`
      : q.url();

    const res = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ url, zone: this.zone }),
    });

    return res.text();
  }
}
