import { vi } from "vitest";
import { Mista } from "../src";

export interface Call {
  method: string;
  url: URL;
  headers: Record<string, string>;
  body: unknown;
}

type Reply = { status?: number; body?: unknown; headers?: Record<string, string> } | Error;

/** A Mista client whose fetch replays `replies` in order and records every call. */
export function mockClient(replies: Reply[], options: { maxRetries?: number } = {}) {
  const calls: Call[] = [];
  const queue = [...replies];
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      method: init?.method ?? "GET",
      url: new URL(String(input)),
      headers: init?.headers as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const reply = queue.shift() ?? { body: { status: "success", data: null } };
    if (reply instanceof Error) throw reply;
    return new Response(reply.body === undefined ? "" : JSON.stringify(reply.body), {
      status: reply.status ?? 200,
      headers: { "Content-Type": "application/json", ...reply.headers },
    });
  });
  const client = new Mista({
    token: "test-token",
    fetch: fetchMock as unknown as typeof fetch,
    maxRetries: options.maxRetries ?? 2,
  });
  return { client, calls, fetchMock };
}

export const ok = (data: unknown, message: string | null = null) => ({
  body: { status: "success", message, data },
});

export const paginated = (rows: unknown[], currentPage = 1, lastPage = 1) => ({
  current_page: currentPage,
  data: rows,
  last_page: lastPage,
  per_page: 25,
  total: rows.length,
});
