# Mista Node.js SDK

Official Node.js / TypeScript client for the [Mista](https://mista.io) Messaging, Verify and Voice APIs.
Full API reference: https://docs.mista.io

```bash
npm install mista-sdk
```

Requires Node.js 18 or newer. Zero runtime dependencies.

## Quickstart

```ts
import { Mista } from "mista-sdk";

const mista = new Mista({ token: process.env.MISTA_API_TOKEN });

const message = await mista.sms.send({
  to: "+1555***4567",
  senderId: "YourBrand",
  message: "Your order has shipped",
});
console.log(message.uid, message.status);
```

Get your API token in the dashboard under **Settings → API**. If you leave out `token`, the
client reads the `MISTA_API_TOKEN` environment variable. CommonJS works too:
`const { Mista } = require("mista-sdk")`.

Request options are camelCase. Responses are returned exactly as the API sends them
(snake_case), so every field matches the docs.

## SMS

`sms.send` sends one message to **one** recipient. To reach several numbers, or to schedule a
send, use a campaign.

```ts
const message = await mista.sms.send({
  to: "+1555***4567",
  senderId: "YourBrand",
  message: "Hello",
  type: "plain", // plain | unicode | voice | mms | whatsapp | viber | otp
});

const latest = await mista.logs.get(message.uid);
latest.status;        // "Queued" | "Sent" | "Delivered" | "Undelivered" | "Expired" | "Rejected" | "Failed"
latest.status_detail; // why it failed, e.g. "Undelivered (handset unreachable)"; null otherwise
```

`Queued` means the carrier has not accepted the message yet and `Sent` means it was accepted and
is waiting for the handset's delivery report. The other five statuses are final. To be told when a
message reaches one, register a [delivery report webhook](#delivery-report-webhooks) instead of polling.

## Campaigns

```ts
// Broadcast: one message, up to 10,000 numbers
await mista.campaigns.bulk({
  senderId: "LOYALTY",
  recipients: ["+1555***4567", "+1555***7890"],
  message: "Double points this weekend!",
  scheduleTime: "2026-12-24 09:00", // or a Date; account timezone
});

// Personalized: one message per number
await mista.campaigns.bulk({
  senderId: "LOYALTY",
  recipients: [
    { to: "+1555***4567", message: "Hi Alice, you have 120 points." },
    { to: "+1555***7890", message: "Hi Bob, you have 45 points." },
  ],
});

// Everyone in one or more contact groups
await mista.campaigns.sendToGroups({ groupUids: ["grp_uid"], senderId: "YourBrand", message: "Hi!" });

const campaign = await mista.campaigns.get("campaign_uid");
```

## Message logs

```ts
const page = await mista.logs.list({ startDate: "2026-10-01", status: "Delivered", perPage: 50 });
page.items;      // this page
page.meta.total; // total matches

for await (const message of page) {
  // walks every remaining page
}
```

Filters: `page`, `perPage`, `startDate`, `endDate` (`Y-m-d`), `from` (sender ID), `status`, `smsType`.
When nothing matches, you get an empty page.

## Account

```ts
const balance = await mista.account.balance(); // { remaining_unit, expired_on, ... }
const me = await mista.account.me();
```

## Contact groups and contacts

```ts
const group = await mista.contactGroups.create("Developers");
await mista.contactGroups.list();
await mista.contactGroups.get(group.uid);
await mista.contactGroups.update(group.uid, "Developers KGL");

const contact = await mista.contacts.create(group.uid, {
  phone: "+1555***4567",
  firstName: "Alice",
  lastName: "Uwase",
  fields: { CITY: "Kigali" }, // custom fields, keyed by the group's field tag
});
await mista.contacts.list(group.uid);
await mista.contacts.get(group.uid, contact.uid);
await mista.contacts.update(group.uid, contact.uid, { phone: "+1555***4567", firstName: "Alicia" });
await mista.contacts.delete(group.uid, contact.uid);

await mista.contactGroups.delete(group.uid); // also deletes its contacts
```

## Verify (OTP)

```ts
const { sid } = await mista.verify.start({ to: "+1555***4567", channel: "sms" });

const result = await mista.verify.check({ sid, code: "123456" });
if (result.verified) {
  // signed in
} else {
  console.log(result.reason); // e.g. "invalid_code"; a wrong code does not throw
}

await mista.verify.get(sid);
```

## Voice

```ts
const { token } = await mista.voice.accessToken({ platform: "ios" });
const numbers = await mista.voice.numbers();
const calls = await mista.voice.calls.list({ filter: "missed", perPage: 20 });
const call = await mista.voice.calls.get("call_uid");
```

## Delivery report webhooks

Mista POSTs a signed JSON event to your URL when a message is delivered (`message.delivered`) or
fails (`message.failed`, with status Undelivered, Expired, Rejected or Failed).

```ts
const webhook = await mista.webhooks.set({ url: "https://example.com/webhooks/mista" });
webhook.secret; // "whsec_..." - store it; you need it to verify requests

await mista.webhooks.test();   // sends a signed webhook.test event now: { delivered, status_code, error }
await mista.webhooks.get();
await mista.webhooks.set({ url: "https://example.com/webhooks/mista", rotateSecret: true });
await mista.webhooks.delete();
```

Verify every request with the **raw** body before trusting it:

```ts
import express from "express";
import { verifyWebhook, WebhookVerificationError } from "mista-sdk";

const app = express();

app.post("/webhooks/mista", express.raw({ type: "application/json" }), (req, res) => {
  try {
    const event = verifyWebhook(req.body, req.header("Mista-Signature"), process.env.MISTA_WEBHOOK_SECRET!);
    if (event.type === "message.delivered") {
      // mark event.data.uid as delivered
    } else if (event.type === "message.failed") {
      // event.data.status is Undelivered | Expired | Rejected | Failed; reason in event.data.status_detail
    }
    res.sendStatus(200);
  } catch (error) {
    if (error instanceof WebhookVerificationError) return res.sendStatus(400);
    throw error;
  }
});
```

`verifyWebhook` checks the HMAC-SHA256 signature and rejects events older than 5 minutes
(`{ tolerance: seconds }` to change, `0` to disable). Answer with any 2xx within 10 seconds;
otherwise Mista retries up to 5 more times over about 3 hours. Retries keep the same `event.id`, so
use it to ignore duplicates. You can also register the URL in the dashboard under **Developers**.

## Errors

Every failure throws a subclass of `MistaError`:

| Class | When |
| --- | --- |
| `BadRequestError` | 400, e.g. an invalid phone number |
| `AuthenticationError` | 401, missing or wrong token |
| `PermissionDeniedError` | 403 |
| `NotFoundError` | 404 |
| `ValidationError` | 422; field problems are in `error.errors` |
| `RateLimitError` | 429 after retries; see `error.retryAfter` |
| `ServerError` | 5xx |
| `APIError` | any other API error, including a 200 whose body says `"status": "error"` (e.g. a contact already in the group) |
| `APIConnectionError` / `APITimeoutError` | network failure or timeout |

```ts
import { ValidationError } from "mista-sdk";

try {
  await mista.sms.send({ to: "123", senderId: "YourBrand", message: "Hi" });
} catch (error) {
  if (error instanceof ValidationError) {
    for (const { field, message } of error.errors) console.log(field, message);
  }
  throw error;
}
```

All API errors carry `status`, `body` (the parsed response) and `headers`.

## Retries and timeouts

```ts
const mista = new Mista({ maxRetries: 2, timeout: 30_000 });
```

- `429 Too Many Requests` is retried for every request, waiting for `Retry-After`.
- Network errors and 5xx responses are retried for `GET` only, so a send is never duplicated.
- Set `maxRetries: 0` to turn retries off.

## Not covered

The retired Push API.

## Development

```bash
npm install          # needs Node 22+ for the dev tooling
npm run typecheck && npm test && npm run build
MISTA_API_TOKEN=... npm run smoke   # read-only: balance + account
```

## License

MIT
