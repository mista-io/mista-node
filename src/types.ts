/*
 * Request options use camelCase. Responses are returned exactly as the API sends
 * them (snake_case), so they match https://docs.mista.io field for field.
 */

export type SmsType = "plain" | "unicode" | "voice" | "mms" | "whatsapp" | "viber" | "otp";

/** `Y-m-d H:i` in your account timezone, or a Date (its local date and time are used). */
export type ScheduleTime = string | Date;

// ---------------------------------------------------------------- SMS

export interface SendSmsParams {
  /** One phone number in international format, e.g. "250780000001". */
  to: string;
  senderId: string;
  message: string;
  type?: SmsType;
  /** Required when type is "mms"; optional for "whatsapp" and "viber". */
  mediaUrl?: string;
  /** Required when type is "voice". */
  language?: string;
  /** Required when type is "voice". */
  gender?: string;
  dltTemplateId?: string;
}

export interface SmsMessage {
  uid: string;
  to: string;
  from: string;
  message: string;
  status: string;
  cost?: string | number;
  [key: string]: unknown;
}

// ---------------------------------------------------------- Campaigns

export interface PersonalizedRecipient {
  to: string;
  message: string;
}

export interface BulkCampaignParams {
  senderId: string;
  /** Phone strings (broadcast, needs `message`) or `{ to, message }` objects (personalized). */
  recipients: string[] | PersonalizedRecipient[];
  message?: string;
  type?: SmsType;
  name?: string;
  scheduleTime?: ScheduleTime;
  dltTemplateId?: string;
}

export interface BulkCampaignResult {
  uid: string;
  campaign_name: string;
  status: string;
  recipient_count: number;
  mode: "broadcast" | "personalized";
}

export interface GroupCampaignParams {
  /** One or more contact group UIDs. */
  groupUids: string | string[];
  senderId: string;
  message: string;
  type?: SmsType;
  scheduleTime?: ScheduleTime;
  dltTemplateId?: string;
}

export interface GroupCampaignResult {
  uid: string;
  campaign_name: string;
  status: string;
}

export interface Campaign {
  id: string;
  name: string;
  message: string;
  status: string;
  type: string;
  created_at: string;
  start_at?: string;
  delivery_at?: string;
  stats?: Record<string, number>;
}

// --------------------------------------------------------------- Logs

export interface ListMessagesParams {
  page?: number;
  perPage?: number;
  /** Y-m-d */
  startDate?: string;
  /** Y-m-d */
  endDate?: string;
  /** Sender ID */
  from?: string;
  /** Delivery status, e.g. "Delivered". */
  status?: string;
  smsType?: SmsType;
}

// ------------------------------------------------------------ Account

export interface Balance {
  remaining_unit: string;
  expired_on: string;
  airtime_balance?: string;
  airtime_currency?: string;
}

export interface Account {
  uid: string;
  api_token: string;
  first_name: string;
  last_name: string;
  email: string;
  locale: string;
  timezone: string;
  last_access_at?: string;
}

// ----------------------------------------------------------- Contacts

export interface ContactGroup {
  uid: string;
  name: string;
}

export interface ContactFields {
  phone: string;
  firstName?: string;
  lastName?: string;
  /** Extra custom fields, keyed by the field tag configured on the group (e.g. { CITY: "Kigali" }). */
  fields?: Record<string, string>;
}

export interface Contact {
  uid: string;
  phone: string | number;
  status: string;
  custom_fields: Record<string, string>;
}

export interface ContactListItem {
  uid: string;
  phone: string | number;
  first_name: string | null;
  last_name: string | null;
}

// ------------------------------------------------------------- Verify

export type VerifyChannel = "auto" | "sms" | "whatsapp" | "whatsapp_sms" | "sms_whatsapp" | "whatsapp_only";

export interface StartVerificationParams {
  to: string;
  /** Omit or "auto" to follow your dashboard Verify settings. */
  channel?: VerifyChannel;
  senderId?: string;
}

export interface Verification {
  sid: string;
  to: string;
  channel: string;
  status: string;
  expires_at: string | null;
  check_attempts?: number;
  verified_at?: string | null;
  created_at?: string | null;
}

export interface CheckVerificationParams {
  sid: string;
  code: string;
}

export interface VerificationCheck {
  /** true when the code was correct. A wrong code is not thrown as an error. */
  verified: boolean;
  sid: string;
  status: string;
  verified_at?: string | null;
  /** Why the check failed, e.g. "invalid_code" or "expired". */
  reason?: string;
}

// -------------------------------------------------------------- Voice

export interface VoiceAccessToken {
  token: string;
  identity?: string;
  caller_id?: string | null;
  account_sid?: string;
  twiml_app_sid?: string;
  [key: string]: unknown;
}

export interface VoiceNumber {
  uid: string;
  number: string;
  [key: string]: unknown;
}

export interface ListCallsParams {
  filter?: "all" | "inbound" | "outbound" | "missed";
  page?: number;
  /** 1-100, default 20. */
  perPage?: number;
}

export interface VoiceCall {
  uid: string;
  direction: "inbound" | "outbound";
  from: string;
  to: string;
  status: string;
  is_active: boolean;
  duration: number | null;
  recording_url: string | null;
  recording_duration: number | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string | null;
}
