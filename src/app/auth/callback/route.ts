import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/session";
import { ensureProfile } from "@/lib/profile";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const nextRaw = url.searchParams.get("next") || "/";
  const next = /^\/(?![\/\\])[^\\]*$/.test(nextRaw) && new URL(nextRaw, url.origin).origin === url.origin ? nextRaw : "/";
  if (code) {
    const sb = await supabaseServer();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) {
      const isNew = await ensureProfile();
      return NextResponse.redirect(new URL(isNew ? "/connectors" : next, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/login?error=Sign-in%20link%20expired", url.origin));
}
