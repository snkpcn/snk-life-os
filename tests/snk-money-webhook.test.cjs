const test = require("node:test");
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { routeLineGroupEvents, verifyLineSignature } = require("../lib/snk-money/webhook.js");

function sign(rawBody, secret = "test-line-secret") {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
}

test("rejects invalid LINE signatures before routing any message", async () => {
  let calls = 0;
  const rawBody = JSON.stringify({ events: [{ source: { type: "group" } }] });
  const result = await routeLineGroupEvents({
    rawBody, signature: "bad", channelSecret: "test-line-secret",
    processEvent: async () => { calls += 1; return true; },
  });
  assert.equal(result.status, 401);
  assert.equal(calls, 0);
});

test("routes group and room events, preserves their order, and reports handled indexes", async () => {
  const events = [
    { type: "message", source: { type: "user" }, marker: "customer" },
    { type: "join", source: { type: "group" }, marker: "private" },
    { type: "message", source: { type: "group" }, marker: "business" },
    { type: "message", source: { type: "room" }, marker: "room" },
  ];
  const rawBody = JSON.stringify({ destination: "bot", events });
  const seen = [];
  const result = await routeLineGroupEvents({
    rawBody, signature: sign(rawBody), channelSecret: "test-line-secret",
    processEvent: async event => { seen.push(event.marker); return event.marker === "private"; },
  });
  assert.deepEqual(seen, ["private", "business", "room"]);
  assert.deepEqual(result, { status: 200, body: { ok: true, handledIndexes: [1] } });
});

test("rejects malformed JSON and an invalid event array", async () => {
  for (const rawBody of ["{", JSON.stringify({ events: null })]) {
    const result = await routeLineGroupEvents({ rawBody, signature: sign(rawBody), channelSecret: "test-line-secret", processEvent: async () => true });
    assert.equal(result.status, 400);
  }
});

test("signature verification requires the exact raw body", () => {
  const rawBody = '{"events":[]}';
  assert.equal(verifyLineSignature(rawBody, sign(rawBody), "test-line-secret"), true);
  assert.equal(verifyLineSignature('{ "events": [] }', sign(rawBody), "test-line-secret"), false);
});

test("private API rejects malformed probe IDs before making a database request", async () => {
  const { POST } = await import("../app/api/line/snk-money/route.ts");
  const prior = process.env.LINE_CHANNEL_SECRET;
  process.env.LINE_CHANNEL_SECRET = "test-line-secret";
  try {
    const rawBody = JSON.stringify({ action: "probe", groups: [{ groupId: "" }] });
    const response = await POST(new Request("https://snk.test/api/line/snk-money", {
      method: "POST",
      headers: { "x-line-signature": sign(rawBody), "content-type": "application/json" },
      body: rawBody,
    }));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { ok: false, error: "invalid_groups" });
  } finally {
    if (prior === undefined) delete process.env.LINE_CHANNEL_SECRET;
    else process.env.LINE_CHANNEL_SECRET = prior;
  }
});
