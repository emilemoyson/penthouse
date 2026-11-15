import { rootSql } from "../db";
import { decrypt, encrypt } from "../crypto";

export type Tokens = { access_token: string; refresh_token?: string; expires_at?: number; [k: string]: unknown };

/** Secrets are written and read with the root client and an explicit user_id; the user's own client can't read them. */
export async function saveConnection(userId: string, connector: string, tokens: Tokens, config: Record<string, unknown> = {}) {
  const sql = rootSql();
  await sql`insert into user_connectors (user_id, connector, status, config, secret, last_error)
            values (${userId}, ${connector}, 'connected', ${sql.json(config as never)}, ${encrypt(JSON.stringify(tokens))}, null)
            on conflict (user_id, connector) do update set status = 'connected', config = user_connectors.config || excluded.config,
              secret = excluded.secret, last_error = null`;
}

export async function loadTokens(userId: string, connector: string): Promise<Tokens | null> {
  const [r] = await rootSql()<{ secret: string | null }[]>`select secret from user_connectors where user_id = ${userId} and connector = ${connector} and status = 'connected'`;
  return r?.secret ? (JSON.parse(decrypt(r.secret)) as Tokens) : null;
}

export async function updateTokens(userId: string, connector: string, tokens: Tokens) {
  await rootSql()`update user_connectors set secret = ${encrypt(JSON.stringify(tokens))} where user_id = ${userId} and connector = ${connector}`;
}

export async function markSynced(userId: string, connector: string, error: string | null) {
  await rootSql()`update user_connectors set last_sync = case when ${error}::text is null then now() else last_sync end, last_error = ${error}
                  where user_id = ${userId} and connector = ${connector}`;
}

/** Marks a non-OAuth connector (phone, paste, upload) as set up for the signed-in user. */
export async function markConnected(userId: string, connector: string, config: Record<string, unknown> = {}) {
  const sql = rootSql();
  await sql`insert into user_connectors (user_id, connector, status, config, last_sync)
            values (${userId}, ${connector}, 'connected', ${sql.json(config as never)}, now())
            on conflict (user_id, connector) do update set status = 'connected', config = user_connectors.config || excluded.config, last_sync = now(), last_error = null`;
}

export async function connectedUsers(connector: string): Promise<string[]> {
  return (await rootSql()<{ user_id: string }[]>`select user_id from user_connectors where connector = ${connector} and status = 'connected' and secret is not null`).map((r) => r.user_id);
}
