import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are not set");
  return { url, key };
}

/** Supabase client bound to the request cookies (server components, actions, route handlers). */
export async function supabaseServer() {
  const store = await cookies();
  const { url, key } = supabaseEnv();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // server components can't set cookies; the middleware refreshes them
        }
      },
    },
  });
}

/** The signed-in user's id (verified JWT), cached for one request. */
export const getUserId = cache(async (): Promise<string | null> => {
  try {
    const sb = await supabaseServer();
    const { data } = await sb.auth.getClaims();
    const sub = data?.claims?.sub;
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
});

export const getSessionUser = cache(async () => {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getClaims();
  const c = data?.claims;
  if (!c?.sub) return null;
  const meta = (c.user_metadata ?? {}) as Record<string, unknown>;
  const name = String(meta.full_name || meta.name || (typeof c.email === "string" ? c.email.split("@")[0] : "") || "");
  return { id: c.sub as string, email: (c.email as string) ?? "", name };
});
