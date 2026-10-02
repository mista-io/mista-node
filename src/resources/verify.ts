import type { Mista } from "../client";
import { ValidationError } from "../errors";
import type {
  CheckVerificationParams,
  StartVerificationParams,
  Verification,
  VerificationCheck,
} from "../types";
import { compact, seg } from "../util";

export class Verify {
  constructor(private readonly client: Mista) {}

  /** Send a one-time code. Keep the returned `sid` for `check()`. */
  start(params: StartVerificationParams): Promise<Verification> {
    return this.client.request<Verification>({
      method: "POST",
      path: "/api/v3/verify",
      body: compact({ to: params.to, channel: params.channel, sender_id: params.senderId }),
    });
  }

  /** Check a code. A wrong or expired code resolves with `verified: false` instead of throwing. */
  async check(params: CheckVerificationParams): Promise<VerificationCheck> {
    try {
      const data = await this.client.request<Omit<VerificationCheck, "verified">>({
        method: "POST",
        path: "/api/v3/verify/check",
        body: { sid: params.sid, code: params.code },
      });
      return { verified: true, ...data };
    } catch (error) {
      const data = error instanceof ValidationError ? (error.body as { data?: unknown })?.data : undefined;
      if (data && typeof data === "object" && "reason" in data) {
        return { verified: false, ...(data as Omit<VerificationCheck, "verified">) };
      }
      throw error;
    }
  }

  get(sid: string): Promise<Verification> {
    return this.client.request<Verification>({ method: "GET", path: `/api/v3/verify/${seg(sid)}` });
  }
}
