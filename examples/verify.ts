import { Mista } from "@mista/sdk";

const mista = new Mista();

const verification = await mista.verify.start({ to: "+250780000001", channel: "sms" });
console.log("Code sent, sid", verification.sid);

// Later, with the code the user typed:
const result = await mista.verify.check({ sid: verification.sid, code: "123456" });
console.log(result.verified ? "Verified" : `Rejected: ${result.reason}`);
