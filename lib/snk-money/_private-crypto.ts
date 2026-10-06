import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function keyFromEnv(name: string): Buffer | null {
  const raw = process.env[name];
  if (!raw) return null;
  const padded = raw + "=".repeat((4 - (raw.length % 4)) % 4);
  const key = Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (key.length !== 32) throw new Error(`${name} must decode to 32 bytes`);
  return key;
}

function primaryKey(): Buffer {
  const key = keyFromEnv("SNK_OS_GROUP_ENCRYPTION_KEY");
  if (!key) throw new Error("SNK_OS_GROUP_ENCRYPTION_KEY is not configured");
  return key;
}

/** New group-id ciphertexts use the SNK-only key and v2 marker. */
export function encryptGroupId(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", primaryKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v2.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

/**
 * Read only SNK-owned ciphertext. The first signed LINE event after cutover
 * reseals the existing active group ID before handling owner requests.
 */
export function decryptGroupId(value: string | null | undefined): string | null {
  if (!value) return null;
  const [version, ivRaw, tagRaw, dataRaw] = value.split(".");
  if (version !== "v2" || !ivRaw || !tagRaw || !dataRaw) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", primaryKey(), Buffer.from(ivRaw, "base64url"));
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(dataRaw, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function lineIdHash(value: string | null | undefined): string | null {
  const text = value?.trim().toLowerCase();
  return text ? createHash("sha256").update(text, "utf8").digest("hex") : null;
}
