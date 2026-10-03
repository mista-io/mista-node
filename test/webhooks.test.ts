import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { WebhookVerificationError, verifyWebhook } from "../src";
import { mockClient, ok } from "./helpers";

const SECRET = "whsec_test";
const NOW = 1_790_000_000;

const event = {
  id: "evt_1",
  type: "message.delivered",
  created_at: "2026-10-03T08:00:00+02:00",
  data: {
    uid: "m1",
    to: "250780000001",
    from: "YourBrand",
    status: "Delivered",
    status_detail: null,
    cost: "1",
    sms_count: 1,
    campaign_uid: null,
    sent_at: "2026-10-03T07:59:50+02:00",
    updated_at: "2026-10-03T08:00:00+02:00",
  },
};

const sign = (body: string, t = NOW, secret = SECRET) =>
  `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;

describe("webhooks resource", () => {
  it("gets, sets, deletes and tests the delivery report webhook", async () => {
    const registration = { url: "https://example.com/hook", secret: SECRET, enabled: true, events: [] };
    const { client, calls } = mockClient([
      ok(registration),
      ok(registration),
      ok({ ...registration, url: null, secret: null, enabled: false }),
      ok({ delivered: true, status_code: 200, error: null, event_id: "evt_t" }),
    ]);

    expect(await client.webhooks.get()).toEqual(registration);
    await client.webhooks.set({ url: "https://example.com/hook", rotateSecret: true });
    await client.webhooks.delete();
    const result = await client.webhooks.test();

    expect(calls.map((c) => [c.method, c.url.pathname])).toEqual([
      ["GET", "/api/v3/webhooks/delivery-reports"],
      ["PUT", "/api/v3/webhooks/delivery-reports"],
      ["DELETE", "/api/v3/webhooks/delivery-reports"],
      ["POST", "/api/v3/webhooks/delivery-reports/test"],
    ]);
    expect(calls[1]!.body).toEqual({ url: "https://example.com/hook", rotate_secret: true });
    expect(result.delivered).toBe(true);
  });

  it("omits rotate_secret unless asked", async () => {
    const { client, calls } = mockClient([ok({})]);
    await client.webhooks.set({ url: "https://example.com/hook" });
    expect(calls[0]!.body).toEqual({ url: "https://example.com/hook" });
  });
});

describe("verifyWebhook", () => {
  const body = JSON.stringify(event);

  it("returns the parsed event for a valid signature", () => {
    expect(verifyWebhook(body, sign(body), SECRET, { now: NOW })).toEqual(event);
    expect(verifyWebhook(Buffer.from(body), sign(body), SECRET, { now: NOW }).data.status).toBe("Delivered");
  });

  it("accepts any matching v1 entry", () => {
    const header = `t=${NOW},v1=${"0".repeat(64)},${sign(body).split(",")[1]}`;
    expect(verifyWebhook(body, header, SECRET, { now: NOW }).id).toBe("evt_1");
  });

  it("is also available on the client", () => {
    const { client } = mockClient([]);
    expect(client.webhooks.verify(body, sign(body), SECRET, { now: NOW }).id).toBe("evt_1");
  });

  it.each([
    ["a tampered body", body.replace("Delivered", "Failed"), sign(body), SECRET, /does not match/],
    ["the wrong secret", body, sign(body), "whsec_other", /does not match/],
    ["a missing header", body, undefined, SECRET, /Missing Mista-Signature/],
    ["a malformed header", body, "v1=abc", SECRET, /Malformed/],
    ["an old timestamp", body, sign(body, NOW - 301), SECRET, /tolerance/],
    ["an empty secret", body, sign(body), "", /Missing webhook secret/],
  ])("rejects %s", (_name, payload, header, secret, message) => {
    expect(() => verifyWebhook(payload, header, secret, { now: NOW })).toThrow(WebhookVerificationError);
    expect(() => verifyWebhook(payload, header, secret, { now: NOW })).toThrow(message);
  });

  it("skips the age check when tolerance is 0", () => {
    expect(verifyWebhook(body, sign(body, 1), SECRET, { now: NOW, tolerance: 0 }).id).toBe("evt_1");
  });
});
