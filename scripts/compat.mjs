// Loads the built package through both ESM and CommonJS on the current Node version.
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const esm = await import("../dist/index.js");
const cjs = require("../dist/index.cjs");

for (const [label, { Mista, NotFoundError, verifyWebhook }] of [["esm", esm], ["cjs", cjs]]) {
  const fetch = async (url) =>
    String(url).endsWith("/api/v3/balance")
      ? new Response(JSON.stringify({ status: "success", data: { remaining_unit: "5" } }))
      : new Response(JSON.stringify({ status: "error", message: "missing" }), { status: 404 });
  const mista = new Mista({ token: "t", fetch });
  assert.equal((await mista.account.balance()).remaining_unit, "5");
  await assert.rejects(mista.logs.get("x"), NotFoundError);

  const body = JSON.stringify({ id: "evt_1", type: "webhook.test", data: {} });
  const t = Math.floor(Date.now() / 1000);
  const header = `t=${t},v1=${createHmac("sha256", "whsec_x").update(`${t}.${body}`).digest("hex")}`;
  assert.equal(verifyWebhook(body, header, "whsec_x").id, "evt_1");

  console.log(`${label}: ok on Node ${process.version}`);
}
