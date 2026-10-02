import { Mista } from "mista-sdk";

const mista = new Mista();

// Broadcast: one message to many numbers, scheduled for tomorrow 09:00 (account timezone).
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
tomorrow.setHours(9, 0, 0, 0);

const broadcast = await mista.campaigns.bulk({
  senderId: "LOYALTY",
  recipients: ["250780000001", "250780000002"],
  message: "Double points this weekend!",
  scheduleTime: tomorrow,
});
console.log("Broadcast", broadcast.uid, broadcast.status);

// Personalized: a different message per number.
const personalized = await mista.campaigns.bulk({
  senderId: "LOYALTY",
  recipients: [
    { to: "250780000001", message: "Hi Alice, you have 120 points." },
    { to: "250780000002", message: "Hi Bob, you have 45 points." },
  ],
});
console.log("Personalized", personalized.uid, personalized.recipient_count);
