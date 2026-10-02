import type { Mista } from "../client";
import type { Account as AccountInfo, Balance } from "../types";

export class Account {
  constructor(private readonly client: Mista) {}

  /** SMS units left and plan expiry. */
  balance(): Promise<Balance> {
    return this.client.request<Balance>({ method: "GET", path: "/api/v3/balance" });
  }

  /** Profile of the account that owns the API token. */
  me(): Promise<AccountInfo> {
    return this.client.request<AccountInfo>({ method: "GET", path: "/api/v3/account/me" });
  }
}
