import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getUserId } from "@/lib/session";
import { PROVIDERS, authorizeUrl, redirectUri } from "@/lib/connectors/oauth";

/** Starts "log in with X": a state cookie against forgery, then off to the provider's own login page. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = Object.hasOwn(PROVIDERS, id) ? PROVIDERS[id] : undefined;
  const back = new URL("/connectors", req.url);
  if (!(await getUserId())) return NextResponse.redirect(new URL("/login?next=/connectors", req.url));
  if (!p || !p.clientId() || !p.clientSecret()) {
    back.searchParams.set("error", `${id} isn't switched on for this site yet.`);
    return NextResponse.redirect(back);
  }
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(p, redirectUri(new URL(req.url).origin, id), state));
  res.cookies.set(`oauth_${id}`, state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
