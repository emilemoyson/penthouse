import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** AES-256-GCM for OAuth tokens at rest. TOKEN_ENC_KEY is 32 random bytes, base64. */
function key() {
  const k = Buffer.from(process.env.TOKEN_ENC_KEY || "", "base64");
  if (k.length !== 32) throw new Error("TOKEN_ENC_KEY must be 32 bytes, base64");
  return k;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), body.toString("base64")].join(".");
}

export function decrypt(box: string): string {
  const [v, iv, tag, body] = box.split(".");
  if (v !== "v1") throw new Error("unknown token format");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(body, "base64")), d.final()]).toString("utf8");
}
