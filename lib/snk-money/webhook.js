const { createHmac, timingSafeEqual } = require("node:crypto");

function verifyLineSignature(rawBody, signature, channelSecret) {
  if (!signature || !channelSecret) return false;
  try {
    const expected = createHmac("sha256", channelSecret).update(rawBody, "utf8").digest();
    const received = Buffer.from(signature, "base64");
    return received.length === expected.length && timingSafeEqual(received, expected);
  } catch {
    return false;
  }
}

async function routeLineGroupEvents({ rawBody, signature, channelSecret, processEvent }) {
  if (!verifyLineSignature(rawBody, signature, channelSecret)) {
    return { status: 401, body: { ok: false, error: "invalid_signature" } };
  }
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { ok: false, error: "invalid_json" } };
  }
  if (!Array.isArray(payload.events)) return { status: 400, body: { ok: false, error: "invalid_events" } };
  const handledIndexes = [];
  for (let index = 0; index < payload.events.length; index += 1) {
    const event = payload.events[index];
    if (!["group", "room"].includes(event?.source?.type)) continue;
    const handled = await processEvent(event);
    if (handled) handledIndexes.push(index);
  }
  return { status: 200, body: { ok: true, handledIndexes } };
}

module.exports = { verifyLineSignature, routeLineGroupEvents };
