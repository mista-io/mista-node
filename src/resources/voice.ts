import type { Mista } from "../client";
import { Page, itemsPage } from "../pagination";
import type { ListCallsParams, VoiceAccessToken, VoiceCall, VoiceNumber } from "../types";
import { seg } from "../util";

class Calls {
  constructor(private readonly client: Mista) {}

  async list(params: ListCallsParams = {}): Promise<Page<VoiceCall>> {
    const raw = await this.client.request<unknown>({
      method: "GET",
      path: "/api/v3/voice/calls",
      query: { filter: params.filter, page: params.page, per_page: params.perPage },
    });
    return itemsPage<VoiceCall>(raw, (page) => this.list({ ...params, page }));
  }

  get(uid: string): Promise<VoiceCall> {
    return this.client.request<VoiceCall>({ method: "GET", path: `/api/v3/voice/calls/${seg(uid)}` });
  }
}

export class Voice {
  readonly calls: Calls;

  constructor(private readonly client: Mista) {
    this.calls = new Calls(client);
  }

  /** A short-lived Twilio Voice access token for the softphone SDKs. */
  accessToken(params: { platform?: string } = {}): Promise<VoiceAccessToken> {
    return this.client.request<VoiceAccessToken>({
      method: "GET",
      path: "/api/v3/voice/access-token",
      query: { platform: params.platform },
    });
  }

  /** Voice-capable phone numbers on your account. */
  numbers(): Promise<VoiceNumber[]> {
    return this.client.request<VoiceNumber[]>({ method: "GET", path: "/api/v3/voice/numbers" });
  }
}
