import { createHash, randomBytes } from "node:crypto";
import { db, rootSql } from "./db";

const hash = (t: string) => createHash("sha256").update(t).digest("hex");

/** Makes (or replaces) the signed-in user's personal ingest key. The plain key is only shown once. */
export async function rotateIngestToken(): Promise<string> {
  const token = "off_" + randomBytes(24).toString("base64url");
  const sql = await db();
  await sql.begin(async (tx) => {
    await tx`delete from ingest_tokens`;
    await tx`insert into ingest_tokens (token_hash) values (${hash(token)})`;
  });
  return token;
}

export async function hasIngestToken(): Promise<boolean> {
  const sql = await db();
  return (await sql`select 1 from ingest_tokens limit 1`).length > 0;
}

/** Which user a bearer key belongs to (null when unknown). Runs without a session, so it uses the root client. */
export async function userForToken(token: string): Promise<string | null> {
  if (!token.startsWith("off_") || token.length < 20) return null;
  const [r] = await rootSql()<{ user_id: string }[]>`select user_id from ingest_tokens where token_hash = ${hash(token)}`;
  return r?.user_id ?? null;
}
