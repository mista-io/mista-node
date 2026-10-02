// Read-only check against the live API. Never sends messages.
// MISTA_API_TOKEN=... npm run build && npm run smoke
import { Mista } from "../dist/index.js";

if (!process.env.MISTA_API_TOKEN) {
  console.log("MISTA_API_TOKEN is not set; skipping live smoke test.");
  process.exit(0);
}

const mista = new Mista({ baseUrl: process.env.MISTA_BASE_URL });
const balance = await mista.account.balance();
console.log("balance:", balance.remaining_unit, "expires", balance.expired_on);
const me = await mista.account.me();
console.log("account:", me.email, me.timezone);
