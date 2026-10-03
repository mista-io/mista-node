import { createHmac, timingSafeEqual } from "node:crypto";
import { MistaError } from "./errors";
import type { WebhookEvent } from "./types";

/** Name of the header that carries the webhook signature. */
export const WEBHOOK_SIGNATURE_HEADER = "mista-signature";

/** Default maximum age of a webhook, in seconds. */
export const DEFAULT_WEBHOOK_TOLERANCE = 300;

export class WebhookVerificationError extends MistaError {}

export interface VerifyWebhookOptions {
  /** Reject events whose timestamp is older (or newer) than this many seconds. 0 disables the check. Default 300. */
  tolerance?: number;
  /** Current time in seconds, for tests. */
  now?: number;
}

/**
 * Check the `Mista-Signature` header of a delivery report webhook and return the parsed event.
 *
 * Pass the raw request body exactly as received. A body that was parsed and re-serialized
 * (e.g. by `express.json()`) will not match the signature.
 *
 * @throws WebhookVerificationError when the header is missing, malformed, too old, or does not match.
 */
export function verifyWebhook(
  payload: string | Uint8Array,
  signatureHeader: string | null | undefined,
  secret: string,
  options: VerifyWebhookOptions = {}
): WebhookEvent {
  if (!secret) throw new WebhookVerificationError("Missing webhook secret");
  if (!signatureHeader) throw new WebhookVerificationError("Missing Mista-Signature header");

  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of signatureHeader.split(",")) {
    const [key, value] = part.trim().split("=", 2);
    if (key === "t" && value) timestamp = Number(value);
    if (key === "v1" && value) signatures.push(value);
  }
  if (timestamp === null || !Number.isInteger(timestamp) || signatures.length === 0) {
    throw new WebhookVerificationError("Malformed Mista-Signature header");
  }

  const tolerance = options.tolerance ?? DEFAULT_WEBHOOK_TOLERANCE;
  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (tolerance > 0 && Math.abs(now - timestamp) > tolerance) {
    throw new WebhookVerificationError("Webhook timestamp is outside the tolerance window");
  }

  const body = typeof payload === "string" ? payload : Buffer.from(payload).toString("utf8");
  const expected = Buffer.from(
    createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex"),
    "utf8"
  );
  const matches = signatures.some((signature) => {
    const given = Buffer.from(signature, "utf8");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!matches) throw new WebhookVerificationError("Webhook signature does not match");

  try {
    return JSON.parse(body) as WebhookEvent;
  } catch {
    throw new WebhookVerificationError("Webhook body is not valid JSON");
  }
}
