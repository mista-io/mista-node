// MISTA_API_TOKEN=... npx tsx examples/send-sms.ts 250780000001
import { Mista } from "mista-sdk";

const mista = new Mista();
const to = process.argv[2];
if (!to) throw new Error("Usage: send-sms.ts <phone>");

const message = await mista.sms.send({ to, senderId: "YourBrand", message: "Hello from Mista" });
console.log("Queued", message.uid);

const latest = await mista.logs.get(message.uid);
console.log("Status", latest.status);
