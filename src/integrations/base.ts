import type { Query } from "../query.js";

export interface IntegrationOptions {
  timeout?: number;
  signal?: AbortSignal;
  debug?: boolean;
}

export abstract class Integration {
  abstract fetchHtml(q: Query | string, opts?: IntegrationOptions): Promise<string> | string;
}

export function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Environment variable ${key} is not set`);
  return val;
}
