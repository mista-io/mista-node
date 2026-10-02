import type { Mista } from "../client";
import { Page, laravelPage } from "../pagination";
import type { Contact, ContactFields, ContactGroup, ContactListItem } from "../types";
import { compact, seg } from "../util";

export class ContactGroups {
  constructor(private readonly client: Mista) {}

  async list(params: { page?: number } = {}): Promise<Page<ContactGroup>> {
    const raw = await this.client.request<unknown>({
      method: "GET",
      path: "/api/v3/contacts",
      query: { page: params.page },
    });
    return laravelPage<ContactGroup>(raw, (page) => this.list({ page }));
  }

  create(name: string): Promise<ContactGroup> {
    return this.client.request<ContactGroup>({ method: "POST", path: "/api/v3/contacts", body: { name } });
  }

  get(groupUid: string): Promise<ContactGroup> {
    return this.client.request<ContactGroup>({
      method: "POST",
      path: `/api/v3/contacts/${seg(groupUid)}/show`,
    });
  }

  update(groupUid: string, name: string): Promise<ContactGroup> {
    return this.client.request<ContactGroup>({
      method: "PATCH",
      path: `/api/v3/contacts/${seg(groupUid)}`,
      body: { name },
    });
  }

  /** Deletes the group and every contact in it. */
  async delete(groupUid: string): Promise<void> {
    await this.client.request<null>({ method: "DELETE", path: `/api/v3/contacts/${seg(groupUid)}` });
  }
}

/** Contact fields are sent by their group field tag (PHONE, FIRST_NAME, LAST_NAME, custom tags). */
function contactBody(fields: ContactFields): Record<string, string> {
  return compact({
    ...fields.fields,
    PHONE: fields.phone,
    FIRST_NAME: fields.firstName,
    LAST_NAME: fields.lastName,
  }) as Record<string, string>;
}

export class Contacts {
  constructor(private readonly client: Mista) {}

  /** Add a contact to a group. Throws an APIError if the phone is already in the group. */
  create(groupUid: string, fields: ContactFields): Promise<Contact> {
    return this.client.request<Contact>({
      method: "POST",
      path: `/api/v3/contacts/${seg(groupUid)}/store`,
      body: contactBody(fields),
    });
  }

  async list(groupUid: string, params: { page?: number } = {}): Promise<Page<ContactListItem>> {
    const raw = await this.client.request<unknown>({
      method: "GET",
      path: `/api/v3/contacts/${seg(groupUid)}/all`,
      query: { page: params.page },
    });
    return laravelPage<ContactListItem>(raw, (page) => this.list(groupUid, { page }));
  }

  get(groupUid: string, uid: string): Promise<Contact> {
    return this.client.request<Contact>({
      method: "POST",
      path: `/api/v3/contacts/${seg(groupUid)}/search/${seg(uid)}`,
    });
  }

  /** `phone` is always required; fields left out keep their current value. */
  update(groupUid: string, uid: string, fields: ContactFields): Promise<Contact> {
    return this.client.request<Contact>({
      method: "PATCH",
      path: `/api/v3/contacts/${seg(groupUid)}/update/${seg(uid)}`,
      body: contactBody(fields),
    });
  }

  async delete(groupUid: string, uid: string): Promise<void> {
    await this.client.request<null>({
      method: "DELETE",
      path: `/api/v3/contacts/${seg(groupUid)}/delete/${seg(uid)}`,
    });
  }
}
