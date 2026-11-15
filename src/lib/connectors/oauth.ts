import type { Tokens } from "./store";
import { loadTokens, updateTokens } from "./store";

export type Provider = {
  id: string;
  authorize: string;
  token: string;
  scope: string;
  clientId: () => string | undefined;
  clientSecret: () => string | undefined;
  extraAuth?: Record<string, string>;
  /** Notion wants HTTP basic auth and a JSON body */
  basicJson?: boolean;
};

export const PROVIDERS: Record<string, Provider> = {
  strava: {
    id: "strava",
    authorize: "https://www.strava.com/oauth/authorize",
    token: "https://www.strava.com/oauth/token",
    scope: "read,activity:read_all",
    clientId: () => process.env.STRAVA_CLIENT_ID,
    clientSecret: () => process.env.STRAVA_CLIENT_SECRET,
    extraAuth: { approval_prompt: "auto" },
  },
  whoop: {
    id: "whoop",
    authorize: "https://api.prod.whoop.com/oauth/oauth2/auth",
    token: "https://api.prod.whoop.com/oauth/oauth2/token",
    scope: "offline read:recovery read:sleep read:workout read:cycles read:profile",
    clientId: () => process.env.WHOOP_CLIENT_ID,
    clientSecret: () => process.env.WHOOP_CLIENT_SECRET,
  },
  google: {
    id: "google",
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    scope: [
      "openid",
      "email",
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/drive.file",
    ].join(" "),
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
    extraAuth: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
  },
  notion: {
    id: "notion",
    authorize: "https://api.notion.com/v1/oauth/authorize",
    token: "https://api.notion.com/v1/oauth/token",
    scope: "",
    clientId: () => process.env.NOTION_CLIENT_ID,
    clientSecret: () => process.env.NOTION_CLIENT_SECRET,
    extraAuth: { owner: "user" },
    basicJson: true,
  },
};

export function redirectUri(origin: string, id: string) {
  return `${process.env.NEXT_PUBLIC_SITE_URL || origin}/api/connect/${id}/callback`;
}

export function authorizeUrl(p: Provider, redirect: string, state: string) {
  const u = new URL(p.authorize);
  u.searchParams.set("client_id", p.clientId()!);
  u.searchParams.set("redirect_uri", redirect);
  u.searchParams.set("response_type", "code");
  if (p.scope) u.searchParams.set("scope", p.scope);
  u.searchParams.set("state", state);
  for (const [k, v] of Object.entries(p.extraAuth ?? {})) u.searchParams.set(k, v);
  return u.toString();
}

async function tokenRequest(p: Provider, params: Record<string, string>): Promise<Tokens> {
  let res: Response;
  if (p.basicJson) {
    res = await fetch(p.token, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Basic " + Buffer.from(`${p.clientId()}:${p.clientSecret()}`).toString("base64"),
      },
      body: JSON.stringify(params),
    });
  } else {
    res = await fetch(p.token, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: p.clientId()!, client_secret: p.clientSecret()!, ...params }),
    });
  }
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || typeof j.access_token !== "string") throw new Error(`${p.id} token request failed (${res.status})`);
  const expiresAt =
    typeof j.expires_at === "number" ? j.expires_at : typeof j.expires_in === "number" ? Math.floor(Date.now() / 1000) + j.expires_in : undefined;
  return { ...(j as Tokens), expires_at: expiresAt };
}

export function exchangeCode(p: Provider, code: string, redirect: string) {
  return tokenRequest(p, { grant_type: "authorization_code", code, redirect_uri: redirect });
}

/** A valid access token for this user, refreshing it first when it is about to expire. */
export async function accessToken(userId: string, id: string): Promise<string> {
  const p = PROVIDERS[id];
  const t = await loadTokens(userId, id);
  if (!t) throw new Error("not connected");
  if (!t.expires_at || t.expires_at - 120 > Date.now() / 1000 || !t.refresh_token) return t.access_token;
  const fresh = await tokenRequest(p, {
    grant_type: "refresh_token",
    refresh_token: t.refresh_token,
    ...(id === "whoop" ? { scope: "offline" } : {}),
  });
  const merged = { ...t, ...fresh, refresh_token: fresh.refresh_token ?? t.refresh_token };
  await updateTokens(userId, id, merged);
  return merged.access_token;
}
