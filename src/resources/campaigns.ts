import type { Mista } from "../client";
import { MistaError } from "../errors";
import type {
  BulkCampaignParams,
  BulkCampaignResult,
  Campaign,
  GroupCampaignParams,
  GroupCampaignResult,
} from "../types";
import { compact, formatScheduleTime, seg } from "../util";

export const MAX_BULK_RECIPIENTS = 10_000;

export class Campaigns {
  constructor(private readonly client: Mista) {}

  /**
   * Send a campaign to phone numbers you hold: either phone strings plus one
   * `message` (broadcast) or `{ to, message }` objects (personalized).
   * Up to 10,000 recipients per request.
   */
  bulk(params: BulkCampaignParams): Promise<BulkCampaignResult> {
    const recipients = params.recipients as unknown[];
    if (!recipients.length) throw new MistaError("recipients must not be empty.");
    if (recipients.length > MAX_BULK_RECIPIENTS) {
      throw new MistaError(`At most ${MAX_BULK_RECIPIENTS} recipients per request.`);
    }
    const strings = recipients.filter((r) => typeof r === "string").length;
    if (strings && strings !== recipients.length) {
      throw new MistaError("Use either phone strings (broadcast) or { to, message } objects, not both.");
    }
    if (strings && !params.message) {
      throw new MistaError("message is required when recipients are phone strings.");
    }
    return this.client.request<BulkCampaignResult>({
      method: "POST",
      path: "/api/v3/campaigns/bulk",
      body: compact({
        sender_id: params.senderId,
        recipients: params.recipients,
        message: strings ? params.message : undefined,
        type: params.type,
        name: params.name,
        schedule_time: formatScheduleTime(params.scheduleTime),
        dlt_template_id: params.dltTemplateId,
      }),
    });
  }

  /** Send one message to every subscribed contact in one or more contact groups. */
  sendToGroups(params: GroupCampaignParams): Promise<GroupCampaignResult> {
    const groups = Array.isArray(params.groupUids) ? params.groupUids : [params.groupUids];
    if (!groups.length) throw new MistaError("groupUids must not be empty.");
    return this.client.request<GroupCampaignResult>({
      method: "POST",
      path: "/api/v3/sms/campaign",
      body: compact({
        contact_list_id: groups.join(","),
        sender_id: params.senderId,
        message: params.message,
        type: params.type,
        schedule_time: formatScheduleTime(params.scheduleTime),
        dlt_template_id: params.dltTemplateId,
      }),
    });
  }

  /** A campaign with its delivery counters. */
  get(uid: string): Promise<Campaign> {
    return this.client.request<Campaign>({ method: "GET", path: `/api/v3/campaign/${seg(uid)}/view` });
  }
}
