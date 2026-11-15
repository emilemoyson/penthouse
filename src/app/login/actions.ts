"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/session";

type State = { error?: string; info?: string } | undefined;

function safeNext(v: FormDataEntryValue | null) {
  const s = String(v || "");
  return /^\/(?![\/\\])[^\\]*$/.test(s) ? s : "";
}

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "https";
  return process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`;
}

export async function signIn(_prev: State, form: FormData): Promise<State> {
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  const mode = String(form.get("mode") || "signin");
  const next = safeNext(form.get("next"));
  if (!email || password.length < 6) return { error: "Enter your email and a password of at least 6 characters." };
  const sb = await supabaseServer();

  if (mode === "signup") {
    const name = String(form.get("name") || "").trim();
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { full_name: name }, emailRedirectTo: `${await origin()}/auth/callback?next=/connectors` },
    });
    if (error) return { error: error.message };
    if (!data.session) return { info: "Check your inbox to confirm your email, then sign in." };
    redirect("/connectors");
  }

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    await new Promise((r) => setTimeout(r, 400));
    return { error: error.message === "Invalid login credentials" ? "That email and password don't match." : error.message };
  }
  redirect(next || "/");
}

export async function signInWithGoogle(form: FormData) {
  const next = safeNext(form.get("next")) || "/";
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect(`/login?error=${encodeURIComponent(error?.message || "Google sign-in failed")}`);
  redirect(data.url);
}

export async function logout() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/login");
}
