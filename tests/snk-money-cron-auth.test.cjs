const assert = require("node:assert/strict");
const test = require("node:test");
const { isAuthorizedCron } = require("../lib/snk-money/cron-auth.js");

test("cron authorization requires the exact configured bearer token", () => {
  assert.equal(isAuthorizedCron(null, "secret-value"), false);
  assert.equal(isAuthorizedCron("secret-value", "secret-value"), false);
  assert.equal(isAuthorizedCron("Bearer wrong", "secret-value"), false);
  assert.equal(isAuthorizedCron("Bearer secret-value", undefined), false);
  assert.equal(isAuthorizedCron("Bearer secret-value", "secret-value"), true);
});
