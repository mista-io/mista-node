import { APIError, Mista } from "@mista/sdk";

const mista = new Mista();

const group = await mista.contactGroups.create("Developers");

try {
  const contact = await mista.contacts.create(group.uid, {
    phone: "250780000001",
    firstName: "Alice",
    lastName: "Uwase",
  });
  console.log("Added", contact.uid);
} catch (error) {
  if (error instanceof APIError) console.error("Not added:", error.message);
  else throw error;
}

for await (const contact of await mista.contacts.list(group.uid)) {
  console.log(contact.phone, contact.first_name);
}

await mista.campaigns.sendToGroups({ groupUids: group.uid, senderId: "YourBrand", message: "Welcome!" });
