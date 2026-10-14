// Single-user password auth. Works in both the Edge middleware and Node server actions (Web Crypto only).

export const COOKIE = "hub_session";
const MAX_AGE_DAYS = 60;

function secret(): string {
  const s = process.env.SESSION_SECRET || process.env.APP_PASSWORD;
  if (!s) throw new Error("APP_PASSWORD is not set");
  return "hub:" + s;
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSessionToken(): Promise<{ token: string; maxAge: number }> {
  const maxAge = MAX_AGE_DAYS * 86400;
  const exp = Math.floor(Date.now() / 1000) + maxAge;
  return { token: `${exp}.${await hmac(String(exp))}`, maxAge };
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  const good = await hmac(exp);
  if (good.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < good.length; i++) diff |= good.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

export function checkPassword(input: string): boolean {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return false;
  if (input.length !== pw.length) return false;
  let diff = 0;
  for (let i = 0; i < pw.length; i++) diff |= pw.charCodeAt(i) ^ input.charCodeAt(i);
  return diff === 0;
}
