import type { Mista } from "../client";
import { MistaError } from "../errors";
import type { SendSmsParams, SmsMessage } from "../types";
import { compact } from "../util";

export class Sms {
  constructor(private readonly client: Mista) {}

  /**
   * Send one SMS to one recipient. It is queued immediately; fetch its delivery
   * status later with `logs.get(uid)`. To reach many numbers or schedule a send,
   * use `campaigns.bulk()`.
   */
  send(params: SendSmsParams): Promise<SmsMessage> {
    if (Array.isArray(params.to) || params.to.includes(",")) {
      throw new MistaError("sms.send() takes one recipient. Use campaigns.bulk() for several numbers.");
    }
    return this.client.request<SmsMessage>({
      method: "POST",
      path: "/api/v3/sms",
      body: compact({
        recipient: params.to,
        sender_id: params.senderId,
        message: params.message,
        type: params.type,
        media_url: params.mediaUrl,
        language: params.language,
        gender: params.gender,
        dlt_template_id: params.dltTemplateId,
      }),
    });
  }
}
