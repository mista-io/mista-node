import { APIConnectionError, APITimeoutError, MistaError, errorFromResponse } from "./errors";
import { Account } from "./resources/account";
import { Campaigns } from "./resources/campaigns";
import { ContactGroups, Contacts } from "./resources/contacts";
import { Logs } from "./resources/logs";
import { Sms } from "./resources/sms";
import { Verify } from "./resources/verify";
import { Voice } from "./resources/voice";
import { Webhooks } from "./resources/webhooks";
import { VERSION } from "./version";

export const DEFAULT_BASE_URL = "https://api.mista.io";

export interface MistaOptions {
  /** API token from Dashboard → Settings → API. Defaults to the MISTA_API_TOKEN environment variable. */
  token?: string;
  /** Defaults to https://api.mista.io */
  baseUrl?: string;
  /** Per-request timeout in milliseconds. Default 30000. */
  timeout?: number;
  /** Retries for rate limits (any request) and network/5xx errors (GET only). Default 2. */
  maxRetries?: number;
  /** Custom fetch implementation (defaults to the global fetch). */
  fetch?: typeof fetch;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  method: HttpMethod;
  path: string;
  query?: Record<string, string | number | undefined | null>;
  body?: unknown;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class Mista {
  readonly sms: Sms;
  readonly campaigns: Campaigns;
  readonly logs: Logs;
  readonly account: Account;
  readonly contactGroups: ContactGroups;
  readonly contacts: Contacts;
  readonly verify: Verify;
  readonly voice: Voice;
  readonly webhooks: Webhooks;

  readonly baseUrl: string;
  readonly timeout: number;
  readonly maxRetries: number;
  readonly #token: string;
  readonly #fetch: typeof fetch;

  constructor(options: MistaOptions = {}) {
    const envToken = typeof process !== "undefined" ? process.env?.MISTA_API_TOKEN : undefined;
    const token = options.token ?? envToken;
    if (!token) {
      throw new MistaError(
        "Missing API token. Pass { token } or set the MISTA_API_TOKEN environment variable."
      );
    }
    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (!fetchImpl) {
      throw new MistaError("No fetch implementation found. Use Node 18+ or pass { fetch }.");
    }

    this.#token = token;
    this.#fetch = fetchImpl;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeout = options.timeout ?? 30_000;
    this.maxRetries = options.maxRetries ?? 2;

    this.sms = new Sms(this);
    this.campaigns = new Campaigns(this);
    this.logs = new Logs(this);
    this.account = new Account(this);
    this.contactGroups = new ContactGroups(this);
    this.contacts = new Contacts(this);
    this.verify = new Verify(this);
    this.voice = new Voice(this);
    this.webhooks = new Webhooks(this);
  }

  /** Send a request and return the `data` field of the response envelope. */
  async request<T>(options: RequestOptions): Promise<T> {
    const url = this.buildUrl(options);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.#token}`,
      Accept: "application/json",
      "User-Agent": `mista-node/${VERSION}`,
    };
    let body: string | undefined;
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    for (let attempt = 0; ; attempt++) {
      let response: Response;
      try {
        response = await this.fetchWithTimeout(url, { method: options.method, headers, body });
      } catch (error) {
        const wrapped =
          error instanceof APITimeoutError
            ? error
            : new APIConnectionError(`Could not reach ${this.baseUrl}: ${String(error)}`, error);
        if (options.method === "GET" && attempt < this.maxRetries) {
          await sleep(this.backoff(attempt));
          continue;
        }
        throw wrapped;
      }

      const payload = await parseBody(response);
      const envelopeError = isRecord(payload) && payload.status === "error";
      if (response.ok && !envelopeError) {
        return (isRecord(payload) && payload.status === "success" && "data" in payload
          ? payload.data
          : payload) as T;
      }

      const retryable =
        response.status === 429 || (response.status >= 500 && options.method === "GET");
      if (retryable && attempt < this.maxRetries) {
        await sleep(this.retryDelay(attempt, response.headers));
        continue;
      }
      throw errorFromResponse(response.status, payload, response.headers);
    }
  }

  private buildUrl({ path, query }: RequestOptions): string {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      return await this.#fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new APITimeoutError(`Request timed out after ${this.timeout}ms`, error);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private backoff(attempt: number): number {
    const base = Math.min(8_000, 500 * 2 ** attempt);
    return base / 2 + Math.random() * (base / 2);
  }

  private retryDelay(attempt: number, headers: Headers): number {
    const retryAfter = Number(headers.get("retry-after"));
    if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter, 60) * 1000;
    return this.backoff(attempt);
  }
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
