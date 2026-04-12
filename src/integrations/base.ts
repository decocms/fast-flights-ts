import type { Query } from "../query.js";

export abstract class Integration {
  abstract fetchHtml(q: Query | string): Promise<string> | string;
}

export function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Environment variable ${key} is not set`);
  return val;
}
