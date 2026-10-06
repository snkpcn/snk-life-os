const { timingSafeEqual } = require("node:crypto");

function isAuthorizedCron(authorization, expected) {
  if (typeof authorization !== "string" || typeof expected !== "string" || !expected) return false;
  if (!authorization.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorization.slice(7), "utf8");
  const secret = Buffer.from(expected, "utf8");
  return supplied.length === secret.length && timingSafeEqual(supplied, secret);
}

module.exports = { isAuthorizedCron };
