import { cache } from "react";
import { db } from "./db";
import { getSessionUser } from "./session";

export type Profile = { name: string; timezone: string; unit: string };

const DEFAULT: Profile = { name: "", timezone: "America/New_York", unit: "kg" };

/** Creates the profile row on first sign-in. Returns true when the user is new. */
export async function ensureProfile(): Promise<boolean> {
  const u = await getSessionUser();
  if (!u) return false;
  const sql = await db();
  const rows = await sql`insert into profiles (name) values (${u.name}) on conflict (user_id) do nothing returning user_id`;
  return rows.length > 0;
}

export const getProfile = cache(async (): Promise<Profile> => {
  try {
    const sql = await db();
    const [p] = await sql<Profile[]>`select name, timezone, unit from profiles limit 1`;
    if (p) return p;
    await ensureProfile();
    const u = await getSessionUser();
    return { ...DEFAULT, name: u?.name ?? "" };
  } catch {
    return DEFAULT;
  }
});

export function firstName(p: Profile) {
  return (p.name || "").split(/\s+/)[0] || "there";
}
