// Loads the built package through both ESM and CommonJS on the current Node version.
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const esm = await import("../dist/index.js");
const cjs = require("../dist/index.cjs");

for (const [label, { Mista, NotFoundError }] of [["esm", esm], ["cjs", cjs]]) {
  const fetch = async (url) =>
    String(url).endsWith("/api/v3/balance")
      ? new Response(JSON.stringify({ status: "success", data: { remaining_unit: "5" } }))
      : new Response(JSON.stringify({ status: "error", message: "missing" }), { status: 404 });
  const mista = new Mista({ token: "t", fetch });
  assert.equal((await mista.account.balance()).remaining_unit, "5");
  await assert.rejects(mista.logs.get("x"), NotFoundError);
  console.log(`${label}: ok on Node ${process.version}`);
}
