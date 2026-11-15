import { NextResponse, type NextRequest } from "next/server";
import { getUserId } from "@/lib/session";
import { PROVIDERS, exchangeCode, redirectUri } from "@/lib/connectors/oauth";
import { saveConnection } from "@/lib/connectors/store";
import { runSync } from "@/lib/connectors/sync";

export const maxDuration = 120;

/** Back from the provider: swap the code for tokens, store them encrypted, pull the last 14 days. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const back = new URL("/connectors", req.url);
  const p = PROVIDERS[id];
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
    await saveConnection(userId, id, tokens, config);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn't finish connecting.");
  }

  const res = await runSync(userId, id, 14);
  back.searchParams.set(res.ok ? "connected" : "error", res.ok ? `${id}:${res.message}` : `Connected, but the first sync failed: ${res.message}`);
  const r = NextResponse.redirect(back);
  r.cookies.delete(`oauth_${id}`);
  return r;
}
