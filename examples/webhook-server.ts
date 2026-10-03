// MISTA_WEBHOOK_SECRET=whsec_... npx tsx examples/webhook-server.ts
// Receives delivery report webhooks on http://localhost:3000/webhooks/mista
import { createServer } from "node:http";
import { WEBHOOK_SIGNATURE_HEADER, WebhookVerificationError, verifyWebhook } from "mista-sdk";

const secret = process.env.MISTA_WEBHOOK_SECRET ?? "";

createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/webhooks/mista") {
    res.writeHead(404).end();
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const rawBody = Buffer.concat(chunks);

  try {
    const event = verifyWebhook(rawBody, req.headers[WEBHOOK_SIGNATURE_HEADER] as string, secret);
    console.log(event.type, event.data.uid, event.data.status, event.data.status_detail ?? "");
    res.writeHead(200).end("ok");
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      res.writeHead(400).end(error.message);
      return;
    }
    throw error;
  }
}).listen(3000, () => console.log("Listening on http://localhost:3000/webhooks/mista"));
