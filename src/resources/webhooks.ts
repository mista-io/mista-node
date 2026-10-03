import type { Mista } from "../client";
import type { DeliveryReportWebhook, SetWebhookParams, WebhookEvent, WebhookTestResult } from "../types";
import { compact } from "../util";
import { verifyWebhook, type VerifyWebhookOptions } from "../webhook-signature";

const PATH = "/api/v3/webhooks/delivery-reports";

/** Delivery report webhook: Mista POSTs to your URL when a message is delivered or fails. */
export class Webhooks {
  constructor(private readonly client: Mista) {}

  /** The current registration. `url` is null when no webhook is set. */
  get(): Promise<DeliveryReportWebhook> {
    return this.client.request<DeliveryReportWebhook>({ method: "GET", path: PATH });
  }

  /** Register or change the webhook URL. The response includes the signing secret. */
  set(params: SetWebhookParams): Promise<DeliveryReportWebhook> {
    return this.client.request<DeliveryReportWebhook>({
      method: "PUT",
      path: PATH,
      body: compact({ url: params.url, rotate_secret: params.rotateSecret }),
    });
  }

  /** Stop sending delivery reports and forget the secret. */
  delete(): Promise<DeliveryReportWebhook> {
    return this.client.request<DeliveryReportWebhook>({ method: "DELETE", path: PATH });
  }

  /** Send a signed `webhook.test` event to the registered URL now and report how it answered. */
  test(): Promise<WebhookTestResult> {
    return this.client.request<WebhookTestResult>({ method: "POST", path: `${PATH}/test` });
  }

  /** Same as the standalone `verifyWebhook`. */
  verify(
    payload: string | Uint8Array,
    signatureHeader: string | null | undefined,
    secret: string,
    options?: VerifyWebhookOptions
  ): WebhookEvent {
    return verifyWebhook(payload, signatureHeader, secret, options);
  }
}
