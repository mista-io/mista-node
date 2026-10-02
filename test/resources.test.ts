import { describe, expect, it } from "vitest";
import { MistaError } from "../src";
import { mockClient, ok, paginated } from "./helpers";

describe("sms", () => {
  it("sends one SMS with snake_case fields", async () => {
    const { client, calls } = mockClient([ok({ uid: "m1", status: "Queued" })]);
    await client.sms.send({ to: "250780000001", senderId: "YourBrand", message: "Hello", type: "plain" });
    expect(calls[0]).toMatchObject({
      method: "POST",
      body: { recipient: "250780000001", sender_id: "YourBrand", message: "Hello", type: "plain" },
    });
    expect(calls[0]!.url.pathname).toBe("/api/v3/sms");
    expect(calls[0]!.headers["Content-Type"]).toBe("application/json");
  });

  it("rejects several recipients before calling the API", () => {
    const { client, calls } = mockClient([]);
    expect(() => client.sms.send({ to: "250780000001,250780000002", senderId: "S", message: "x" })).toThrow(MistaError);
    expect(calls).toHaveLength(0);
  });
});

describe("campaigns", () => {
  it("sends a broadcast with a formatted schedule time", async () => {
    const { client, calls } = mockClient([ok({ uid: "c1", mode: "broadcast" })]);
    await client.campaigns.bulk({
      senderId: "LOYALTY",
      recipients: ["250780000001", "250780000002"],
      message: "Double points!",
      scheduleTime: new Date(2026, 11, 24, 9, 5),
    });
    expect(calls[0]!.url.pathname).toBe("/api/v3/campaigns/bulk");
    expect(calls[0]!.body).toEqual({
      sender_id: "LOYALTY",
      recipients: ["250780000001", "250780000002"],
      message: "Double points!",
      schedule_time: "2026-12-24 09:05",
    });
  });

  it("sends personalized recipients without a top-level message", async () => {
    const { client, calls } = mockClient([ok({ uid: "c1", mode: "personalized" })]);
    await client.campaigns.bulk({
      senderId: "LOYALTY",
      recipients: [{ to: "250780000001", message: "Hi Alice" }],
      message: "ignored",
    });
    expect(calls[0]!.body).toEqual({
      sender_id: "LOYALTY",
      recipients: [{ to: "250780000001", message: "Hi Alice" }],
    });
  });

  it("validates recipients client-side", () => {
    const { client } = mockClient([]);
    const mixed = ["250780000001", { to: "250780000002", message: "x" }] as never;
    expect(() => client.campaigns.bulk({ senderId: "S", recipients: mixed, message: "m" })).toThrow(/not both/);
    expect(() => client.campaigns.bulk({ senderId: "S", recipients: ["250780000001"] })).toThrow(/message is required/);
    expect(() => client.campaigns.bulk({ senderId: "S", recipients: [] })).toThrow(/empty/);
    const tooMany = Array.from({ length: 10_001 }, () => "250780000001");
    expect(() => client.campaigns.bulk({ senderId: "S", recipients: tooMany, message: "m" })).toThrow(/10000/);
  });

  it("sends to contact groups with comma-joined UIDs", async () => {
    const { client, calls } = mockClient([ok({ uid: "c2" })]);
    await client.campaigns.sendToGroups({ groupUids: ["g1", "g2"], senderId: "S", message: "Hi" });
    expect(calls[0]!.url.pathname).toBe("/api/v3/sms/campaign");
    expect(calls[0]!.body).toEqual({ contact_list_id: "g1,g2", sender_id: "S", message: "Hi" });
  });

  it("gets a campaign", async () => {
    const { client, calls } = mockClient([ok({ id: "c1" })]);
    await client.campaigns.get("c1");
    expect(calls[0]).toMatchObject({ method: "GET" });
    expect(calls[0]!.url.pathname).toBe("/api/v3/campaign/c1/view");
  });
});

describe("logs", () => {
  it("lists messages with filters and walks every page", async () => {
    const { client, calls } = mockClient([
      ok(paginated([{ uid: "a" }, { uid: "b" }], 1, 2)),
      ok(paginated([{ uid: "c" }], 2, 2)),
    ]);
    const page = await client.logs.list({ startDate: "2026-10-01", status: "Delivered", perPage: 2 });
    expect(page.items.map((m) => m.uid)).toEqual(["a", "b"]);
    expect(page.hasNextPage()).toBe(true);
    expect(calls[0]!.url.pathname).toBe("/api/v3/log/view");
    expect(Object.fromEntries(calls[0]!.url.searchParams)).toEqual({
      start_date: "2026-10-01",
      status: "Delivered",
      per_page: "2",
    });

    const uids: string[] = [];
    for await (const message of page) uids.push(message.uid);
    expect(uids).toEqual(["a", "b", "c"]);
    expect(calls[1]!.url.searchParams.get("page")).toBe("2");
  });

  it("returns an empty page when nothing matches (API answers 404)", async () => {
    const { client } = mockClient([{ status: 404, body: { status: "error", message: "SMS Info not found" } }]);
    const page = await client.logs.list({ from: "Nobody" });
    expect(page.items).toEqual([]);
    expect(page.hasNextPage()).toBe(false);
  });

  it("gets one message", async () => {
    const { client, calls } = mockClient([ok({ uid: "m1" })]);
    await client.logs.get("m1");
    expect(calls[0]!.url.pathname).toBe("/api/v3/log/m1");
  });
});

describe("contact groups", () => {
  it("covers list, create, get, update and delete", async () => {
    const { client, calls } = mockClient([
      ok(paginated([{ uid: "g1", name: "Devs" }])),
      ok({ uid: "g1", name: "Devs" }),
      ok({ uid: "g1", name: "Devs" }),
      ok({ uid: "g1", name: "Devs KGL" }),
      ok(null, "Contact group was successfully deleted"),
    ]);
    const page = await client.contactGroups.list();
    expect(page.items).toEqual([{ uid: "g1", name: "Devs" }]);
    await client.contactGroups.create("Devs");
    await client.contactGroups.get("g1");
    await client.contactGroups.update("g1", "Devs KGL");
    await expect(client.contactGroups.delete("g1")).resolves.toBeUndefined();

    expect(calls.map((c) => `${c.method} ${c.url.pathname}`)).toEqual([
      "GET /api/v3/contacts",
      "POST /api/v3/contacts",
      "POST /api/v3/contacts/g1/show",
      "PATCH /api/v3/contacts/g1",
      "DELETE /api/v3/contacts/g1",
    ]);
    expect(calls[1]!.body).toEqual({ name: "Devs" });
    expect(calls[3]!.body).toEqual({ name: "Devs KGL" });
    expect(calls[4]!.body).toBeUndefined();
  });
});

describe("contacts", () => {
  it("sends fields by their group tags", async () => {
    const { client, calls } = mockClient([ok({ uid: "c1" }), ok({ uid: "c1" })]);
    await client.contacts.create("g1", {
      phone: "250780000001",
      firstName: "Alice",
      lastName: "Uwase",
      fields: { CITY: "Kigali" },
    });
    await client.contacts.update("g1", "c1", { phone: "250780000001", firstName: "Alicia" });
    expect(calls[0]!.url.pathname).toBe("/api/v3/contacts/g1/store");
    expect(calls[0]!.body).toEqual({ CITY: "Kigali", PHONE: "250780000001", FIRST_NAME: "Alice", LAST_NAME: "Uwase" });
    expect(calls[1]).toMatchObject({ method: "PATCH", body: { PHONE: "250780000001", FIRST_NAME: "Alicia" } });
    expect(calls[1]!.url.pathname).toBe("/api/v3/contacts/g1/update/c1");
  });

  it("lists, gets and deletes", async () => {
    const { client, calls } = mockClient([ok(paginated([{ uid: "c1" }])), ok({ uid: "c1" }), ok(null)]);
    await client.contacts.list("g1", { page: 3 });
    await client.contacts.get("g1", "c1");
    await client.contacts.delete("g1", "c1");
    expect(calls.map((c) => `${c.method} ${c.url.pathname}${c.url.search}`)).toEqual([
      "GET /api/v3/contacts/g1/all?page=3",
      "POST /api/v3/contacts/g1/search/c1",
      "DELETE /api/v3/contacts/g1/delete/c1",
    ]);
  });
});

describe("verify", () => {
  it("starts a verification", async () => {
    const { client, calls } = mockClient([ok({ sid: "v1", status: "pending" })]);
    await client.verify.start({ to: "+250780000001", channel: "sms", senderId: "MISTA" });
    expect(calls[0]!.url.pathname).toBe("/api/v3/verify");
    expect(calls[0]!.body).toEqual({ to: "+250780000001", channel: "sms", sender_id: "MISTA" });
  });

  it("returns verified: true for a correct code", async () => {
    const { client, calls } = mockClient([ok({ sid: "v1", status: "approved", verified_at: "t" })]);
    await expect(client.verify.check({ sid: "v1", code: "123456" })).resolves.toEqual({
      verified: true,
      sid: "v1",
      status: "approved",
      verified_at: "t",
    });
    expect(calls[0]!.url.pathname).toBe("/api/v3/verify/check");
  });

  it("returns verified: false for a wrong code instead of throwing", async () => {
    const { client } = mockClient([
      {
        status: 422,
        body: { status: "error", message: "Verification failed", data: { sid: "v1", status: "pending", reason: "invalid_code" } },
      },
    ]);
    await expect(client.verify.check({ sid: "v1", code: "000000" })).resolves.toEqual({
      verified: false,
      sid: "v1",
      status: "pending",
      reason: "invalid_code",
    });
  });

  it("still throws for other errors", async () => {
    const { client } = mockClient([{ status: 422, body: { status: "error", message: "Verification not found." } }]);
    await expect(client.verify.check({ sid: "nope", code: "1" })).rejects.toThrow("Verification not found.");
  });

  it("gets a verification", async () => {
    const { client, calls } = mockClient([ok({ sid: "v1" })]);
    await client.verify.get("v1");
    expect(calls[0]!.url.pathname).toBe("/api/v3/verify/v1");
  });
});

describe("voice", () => {
  it("covers access token, numbers and calls", async () => {
    const { client, calls } = mockClient([
      ok({ token: "jwt" }),
      ok([{ uid: "n1", number: "+250780000001" }]),
      ok({ items: [{ uid: "call1" }], pagination: { current_page: 1, per_page: 20, total: 1, last_page: 1 } }),
      ok({ uid: "call1" }),
    ]);
    await client.voice.accessToken({ platform: "ios" });
    await expect(client.voice.numbers()).resolves.toHaveLength(1);
    const page = await client.voice.calls.list({ filter: "missed", perPage: 20 });
    expect(page.items).toEqual([{ uid: "call1" }]);
    expect(page.meta).toEqual({ currentPage: 1, lastPage: 1, perPage: 20, total: 1 });
    await client.voice.calls.get("call1");
    expect(calls.map((c) => `${c.method} ${c.url.pathname}${c.url.search}`)).toEqual([
      "GET /api/v3/voice/access-token?platform=ios",
      "GET /api/v3/voice/numbers",
      "GET /api/v3/voice/calls?filter=missed&per_page=20",
      "GET /api/v3/voice/calls/call1",
    ]);
  });
});
