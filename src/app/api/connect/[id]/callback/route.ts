import { after, NextResponse, type NextRequest } from "next/server";
import { getUserId } from "@/lib/session";
import { PROVIDERS, exchangeCode, redirectUri } from "@/lib/connectors/oauth";
import { saveConnection } from "@/lib/connectors/store";
import { rootSql } from "@/lib/db";
import { runSync } from "@/lib/connectors/sync";

export const maxDuration = 300;

/** Back from the provider: swap the code for tokens, store them encrypted, pull the last 14 days. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const back = new URL("/connectors", req.url);
  const p = Object.hasOwn(PROVIDERS, id) ? PROVIDERS[id] : undefined;
  const userId = await getUserId();
  const expected = req.cookies.get(`oauth_${id}`)?.value;
  const fail = (msg: string) => {
    back.searchParams.set("error", msg);
    const r = NextResponse.redirect(back);
    r.cookies.delete(`oauth_${id}`);
    return r;
  };
  if (!p || !userId) return fail("Sign in first, then connect.");
  if (url.searchParams.get("error")) return fail(`${id} wasn't connected (you can try again).`);
  const code = url.searchParams.get("code");
  if (!code || !expected || url.searchParams.get("state") !== expected) return fail("That link expired. Try connecting again.");

  try {
    const tokens = await exchangeCode(p, code, redirectUri(url.origin, id));
    const config: Record<string, unknown> = {};
    // keep a readable account label, never the tokens themselves
    const athlete = tokens.athlete as { firstname?: string; lastname?: string } | undefined;
    if (athlete?.firstname) config.account = `${athlete.firstname} ${athlete.lastname ?? ""}`.trim();
    if (typeof tokens.workspace_name === "string") config.account = tokens.workspace_name;
    delete tokens.athlete;
    if (typeof tokens.id_token === "string") {
      // straight from Google's token endpoint over TLS, so the payload can be read without re-verifying
      try {
        const claims = JSON.parse(Buffer.from(tokens.id_token.split(".")[1], "base64url").toString("utf8")) as { email?: string };
        if (claims.email) config.account = claims.email;
      } catch {}
      delete tokens.id_token;
    }
    if (id === "google" && config.account) {
      // a different Google account starts fresh: its calendars and sheet are not the old ones
      await rootSql()`update user_connectors set config = '{}'::jsonb
        where user_id = ${userId} and connector = 'google' and coalesce(config->>'account', '') <> ${String(config.account)}`;
    }
    await saveConnection(userId, id, tokens, config);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn't finish connecting.");
  }

  if (id === "google") {
    // reading two weeks of email takes a minute; the calendar shows straight away
    after(() => runSync(userId, id, 14).then(() => undefined));
    back.searchParams.set("connected", `${id}:your calendars. Claude is reading the last two weeks of email in the background`);
    const r = NextResponse.redirect(back);
    r.cookies.delete(`oauth_${id}`);
    return r;
  }
  const res = await runSync(userId, id, 14);
  back.searchParams.set(res.ok ? "connected" : "error", res.ok ? `${id}:${res.message}` : `Connected, but the first sync failed: ${res.message}`);
  const r = NextResponse.redirect(back);
  r.cookies.delete(`oauth_${id}`);
  return r;
}
