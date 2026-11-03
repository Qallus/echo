import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Customer and custom-provider API keys are encrypted here before they reach
// the database (AES-256-GCM with AI_KEYS_SECRET, a 32-byte base64 secret held
// only on the server). Format: "v1:" + base64(iv | tag | ciphertext).

function secret(): Buffer {
  const raw = process.env.AI_KEYS_SECRET;
  const key = raw ? Buffer.from(raw, "base64") : null;
  if (!key || key.length !== 32) throw new Error("AI_KEYS_SECRET must be set to 32 random bytes (base64).");
  return key;
}

export function encryptKey(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64")}`;
}

export function decryptKey(stored: string): string {
  if (!stored.startsWith("v1:")) throw new Error("Unknown key format.");
  const data = Buffer.from(stored.slice(3), "base64");
  const decipher = createDecipheriv("aes-256-gcm", secret(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8");
}

export const last4 = (key: string) => key.trim().slice(-4);
