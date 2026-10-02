import type { Mista } from "../client";
import { NotFoundError } from "../errors";
import { Page, emptyPage, laravelPage } from "../pagination";
import type { ListMessagesParams, SmsMessage } from "../types";
import { seg } from "../util";

export class Logs {
  constructor(private readonly client: Mista) {}

  /** Messages sent from your account, newest first. `for await` the page to walk all pages. */
  async list(params: ListMessagesParams = {}): Promise<Page<SmsMessage>> {
    const fetchPage = (page: number) => this.list({ ...params, page });
    try {
      const raw = await this.client.request<unknown>({
        method: "GET",
        path: "/api/v3/log/view",
        query: {
          page: params.page,
          per_page: params.perPage,
          start_date: params.startDate,
          end_date: params.endDate,
          from: params.from,
          status: params.status,
          sms_type: params.smsType,
        },
      });
      return laravelPage<SmsMessage>(raw, fetchPage);
    } catch (error) {
      // The API answers 404 "SMS Info not found" when nothing matches the filters.
      if (error instanceof NotFoundError) return emptyPage<SmsMessage>(fetchPage);
      throw error;
    }
  }

  /** One message and its current delivery status. */
  get(uid: string): Promise<SmsMessage> {
    return this.client.request<SmsMessage>({ method: "GET", path: `/api/v3/log/${seg(uid)}` });
  }
}
