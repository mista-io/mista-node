import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  APIConnectionError,
  APIError,
  AuthenticationError,
  BadRequestError,
  Mista,
  MistaError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
  ServerError,
  VERSION,
  ValidationError,
} from "../src";
import { mockClient, ok } from "./helpers";

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 1000 });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("client", () => {
  it("sends auth, accept and user-agent headers to the canonical base URL", async () => {
    const { client, calls } = mockClient([ok({ remaining_unit: "10" })]);
    await client.account.balance();
    expect(calls[0]!.url.toString()).toBe("https://api.mista.io/api/v3/balance");
    expect(calls[0]!.headers).toMatchObject({
      Authorization: "Bearer test-token",
      Accept: "application/json",
      "User-Agent": `mista-node/${VERSION}`,
    });
    expect(calls[0]!.headers["Content-Type"]).toBeUndefined();
  });

  it("unwraps the data envelope", async () => {
    const { client } = mockClient([ok({ remaining_unit: "1,250", expired_on: "x" })]);
    await expect(client.account.balance()).resolves.toEqual({ remaining_unit: "1,250", expired_on: "x" });
  });

  it("reads the token from MISTA_API_TOKEN and fails clearly without one", () => {
    const previous = process.env.MISTA_API_TOKEN;
    delete process.env.MISTA_API_TOKEN;
    expect(() => new Mista()).toThrow(MistaError);
    process.env.MISTA_API_TOKEN = "env-token";
    expect(() => new Mista({ fetch: (() => {}) as unknown as typeof fetch })).not.toThrow();
    if (previous === undefined) delete process.env.MISTA_API_TOKEN;
    else process.env.MISTA_API_TOKEN = previous;
  });

  it("honours a custom base URL", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: "success", data: {} })));
    const client = new Mista({ token: "t", baseUrl: "https://example.test/", fetch: fetchMock as never });
    await client.account.me();
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe("https://example.test/api/v3/account/me");
  });

  it.each([
    [400, BadRequestError],
    [401, AuthenticationError],
    [403, PermissionDeniedError],
    [404, NotFoundError],
    [422, ValidationError],
    [418, APIError],
  ])("maps HTTP %i to %s", async (status, ErrorClass) => {
    const { client } = mockClient([{ status, body: { status: "error", message: "nope" } }]);
    const error = await client.account.me().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorClass);
    expect(error).toMatchObject({ status, message: "nope" });
  });

  it("treats a 200 with status=error as an APIError", async () => {
    const { client } = mockClient([
      { body: { status: "error", message: "You have already subscribed to Developers" } },
    ]);
    const error = await client.contacts.create("g1", { phone: "250780000001" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(APIError);
    expect((error as APIError).message).toBe("You have already subscribed to Developers");
  });

  it("parses FastAPI detail[] into field errors", async () => {
    const { client } = mockClient([
      {
        status: 422,
        body: { detail: [{ type: "missing", loc: ["body", "sender_id"], msg: "Field required", input: null }] },
      },
    ]);
    const error = (await client.sms
      .send({ to: "250780000001", senderId: "", message: "hi" })
      .catch((e: unknown) => e)) as ValidationError;
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toBe("sender_id: Field required");
    expect(error.errors).toEqual([{ field: "sender_id", message: "Field required", type: "missing" }]);
  });

  it("parses Laravel errors{} into field errors", async () => {
    const { client } = mockClient([
      { status: 422, body: { message: "The name field is required.", errors: { name: ["The name field is required."] } } },
    ]);
    const error = (await client.contactGroups.create("").catch((e: unknown) => e)) as ValidationError;
    expect(error.errors).toEqual([{ field: "name", message: "The name field is required.", type: null }]);
  });

  it("retries 429 on any method, honouring Retry-After", async () => {
    const { client, calls } = mockClient([
      { status: 429, body: { message: "Too Many Attempts." }, headers: { "Retry-After": "1" } },
      ok({ uid: "m1" }),
    ]);
    await expect(client.sms.send({ to: "250780000001", senderId: "S", message: "hi" })).resolves.toEqual({ uid: "m1" });
    expect(calls).toHaveLength(2);
  });

  it("gives up after maxRetries and throws RateLimitError", async () => {
    const limited = { status: 429, body: { message: "Too Many Attempts." }, headers: { "Retry-After": "1" } };
    const { client, calls } = mockClient([limited, limited, limited], { maxRetries: 2 });
    const error = await client.account.me().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).retryAfter).toBe(1);
    expect(calls).toHaveLength(3);
  });

  it("retries 5xx for GET but never for POST", async () => {
    const boom = { status: 503, body: { status: "error", message: "down" } };
    const get = mockClient([boom, ok({})]);
    await get.client.account.me();
    expect(get.calls).toHaveLength(2);

    const post = mockClient([boom, ok({})]);
    await expect(post.client.sms.send({ to: "250780000001", senderId: "S", message: "hi" })).rejects.toBeInstanceOf(ServerError);
    expect(post.calls).toHaveLength(1);
  });

  it("retries network errors for GET only and wraps them", async () => {
    const get = mockClient([new TypeError("fetch failed"), ok({})]);
    await get.client.account.me();
    expect(get.calls).toHaveLength(2);

    const post = mockClient([new TypeError("fetch failed")]);
    await expect(post.client.contactGroups.create("x")).rejects.toBeInstanceOf(APIConnectionError);
    expect(post.calls).toHaveLength(1);
  });
});
