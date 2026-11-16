"use server";

import { safeFetchText } from "@/lib/safe-fetch";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, getKV, rootSql, runAsUser, setKV } from "@/lib/db";
import { getUserId, supabaseServer } from "@/lib/session";
import { rotateIngestToken } from "@/lib/ingest-tokens";
import { importWorkoutText } from "@/lib/workout-import";
import { markConnected } from "@/lib/connectors/store";
import { accessToken } from "@/lib/connectors/oauth";
import { clearCalendarCache, googleConfig, listCalendars, setGoogleConfig, syncSheet, type CalendarChoice } from "@/lib/connectors/google";
import { byId } from "@/lib/connectors/catalog";
import { runSync, canSync } from "@/lib/connectors/sync";
import { readReceipt } from "@/lib/receipt";
import { GroceryItemIn, saveGroceryRun } from "@/lib/groceries";
import { todayISO } from "@/lib/dates";

type Result = { ok: boolean; message: string; token?: string };

async function uid() {
  const id = await getUserId();
  if (!id) redirect("/login?next=/connectors");
  return id;
}

export async function newKey(): Promise<Result> {
  const id = await uid();
  const token = await runAsUser(id, rotateIngestToken);
  revalidatePath("/connectors");
  return { ok: true, message: "New key made. It is shown once; older ones stop working.", token };
}

export async function pasteNotes(_p: Result | undefined, form: FormData): Promise<Result> {
  const id = await uid();
  const text = String(form.get("text") || "");
  if (text.trim().length < 10) return { ok: false, message: "Paste the whole note first." };
  if (text.length > 60_000) return { ok: false, message: "That note is very long. Paste the last few weeks." };
  const res = await runAsUser(id, () => importWorkoutText(text, "note", { hint: "an iPhone Notes workout log" }));
  if (res.sessions) await markConnected(id, "apple-notes", { via: "paste" });
  revalidatePath("/", "layout");
  return { ok: res.sessions > 0, message: res.message };
}

export async function saveCalendar(_p: Result | undefined, form: FormData): Promise<Result> {
  const id = await uid();
  const urls = String(form.get("urls") || "")
    .split(/[\s,]+/)
    .map((u) => u.trim().replace(/^webcal:\/\//i, "https://"))
    .filter(Boolean);
  if (urls.some((u) => !/^https:\/\/[^\s]+$/i.test(u))) return { ok: false, message: "Those should be https or webcal links." };
  if (urls.length > 5) return { ok: false, message: "Up to 5 calendars." };
  // check each one answers with a calendar before saving
  for (const u of urls) {
    try {
      const r = await safeFetchText(u);
      const t = r.ok ? r.text.slice(0, 200) : "";
      if (!t.includes("BEGIN:VCALENDAR")) return { ok: false, message: "One link didn't return a calendar. Use the secret iCal address." };
    } catch {
      return { ok: false, message: "Couldn't reach one of those links." };
    }
  }
  await runAsUser(id, () => setKV("calendar_urls", urls));
  if (urls.length) await markConnected(id, "calendar", { count: urls.length });
  else await disconnectRow(id, "calendar");
  revalidatePath("/", "layout");
  return { ok: true, message: urls.length ? `Saved ${urls.length} calendar${urls.length > 1 ? "s" : ""}.` : "Calendar removed." };
}

export async function markSetUp(connector: string) {
  const id = await uid();
  const c = byId(connector);
  if (!c || (c.method !== "guide" && c.method !== "phone")) return;
  await markConnected(id, connector, { via: "guide" });
  revalidatePath("/connectors");
}

async function disconnectRow(id: string, connector: string) {
  await rootSql()`delete from user_connectors where user_id = ${id} and connector = ${connector}`;
}

export async function disconnect(connector: string) {
  const id = await uid();
  await disconnectRow(id, connector);
  if (connector === "calendar") await runAsUser(id, () => setKV("calendar_urls", []));
  revalidatePath("/", "layout");
}

export async function syncNow(connector: string): Promise<Result> {
  const id = await uid();
  if (!canSync(connector)) return { ok: false, message: "Nothing to sync." };
  const r = await runSync(id, connector, 14);
  revalidatePath("/", "layout");
  return r;
}

export async function saveProfile(_p: Result | undefined, form: FormData): Promise<Result> {
  const id = await uid();
  const name = String(form.get("name") || "").trim().slice(0, 60);
  const tz = String(form.get("timezone") || "America/New_York");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    return { ok: false, message: "Unknown time zone." };
  }
  await runAsUser(id, async () => {
    const sql = await db();
    await sql`insert into profiles (name, timezone) values (${name}, ${tz})
              on conflict (user_id) do update set name = excluded.name, timezone = excluded.timezone`;
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

export async function requestConnector(_p: Result | undefined, form: FormData): Promise<Result> {
  const id = await uid();
  const name = String(form.get("name") || "").trim().slice(0, 80);
  const detail = String(form.get("detail") || "").trim().slice(0, 1000);
  if (name.length < 2) return { ok: false, message: "Which app or device?" };
  const recent = await runAsUser(id, async () => {
    const sql = await db();
    const [r] = await sql<{ n: number }[]>`select count(*)::int as n from connector_requests where created_at > now() - interval '1 day'`;
    return r.n;
  });
  if (recent >= 5) return { ok: false, message: "That's plenty for today. Thank you." };
  const { openConnectorIssue } = await import("@/lib/connectors/request");
  const issueUrl = await openConnectorIssue(name, detail).catch(() => null);
  await runAsUser(id, async () => {
    const sql = await db();
    await sql`insert into connector_requests (name, detail, issue_url) values (${name}, ${detail}, ${issueUrl})`;
  });
  return { ok: true, message: issueUrl ? "Sent. Emile gets it as a GitHub issue, and Claude drafts the connector." : "Saved. Emile will see it." };
}

export async function deleteAccount(form: FormData) {
  const id = await uid();
  if (String(form.get("confirm") || "") !== "delete") redirect("/connectors?error=Type%20delete%20to%20confirm");
  // every table cascades from auth.users; this removes the user and all their rows
  await rootSql()`delete from auth.users where id = ${id}`;
  const sb = await supabaseServer();
  await sb.auth.signOut().catch(() => {});
  redirect("/login?error=Your%20account%20and%20data%20were%20deleted.");
}

export async function getCalendarUrls() {
  const id = await uid();
  return runAsUser(id, () => getKV<string[]>("calendar_urls", []));
}

/* ---------- Google ---------- */

export async function googleCalendars(): Promise<{ ok: boolean; message: string; items: CalendarChoice[] }> {
  const id = await uid();
  try {
    return { ok: true, message: "", items: await listCalendars(id) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Couldn't reach Google.", items: [] };
  }
}

export async function saveGoogleCalendars(ids: string[]): Promise<Result> {
  const id = await uid();
  let known: Set<string>;
  try {
    known = new Set((await listCalendars(id)).map((c) => c.id));
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Couldn't reach Google." };
  }
  const chosen = [...new Set(ids)].filter((c) => known.has(c)).slice(0, 15);
  await setGoogleConfig(id, { calendars: chosen });
  clearCalendarCache(id);
  revalidatePath("/", "layout");
  return { ok: true, message: `Showing ${chosen.length} calendar${chosen.length === 1 ? "" : "s"}.` };
}

/** A short-lived Google token for the file picker in this user's browser. drive.file only covers files they pick. */
export async function pickerToken(): Promise<{ ok: boolean; token?: string; message: string }> {
  const id = await uid();
  if (!(await googleConfig(id))) return { ok: false, message: "Connect Google first." };
  try {
    return { ok: true, token: await accessToken(id, "google"), message: "" };
  } catch {
    return { ok: false, message: "The Google connection expired. Connect again." };
  }
}

export async function saveSheet(sheetId: string): Promise<Result> {
  const id = await uid();
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(sheetId)) return { ok: false, message: "That isn't a Google Sheet." };
  const cfg = await googleConfig(id);
  if (!cfg) return { ok: false, message: "Connect Google first." };
  try {
    const token = await accessToken(id, "google");
    const msg = await syncSheet(id, token, { ...cfg, sheetId }, true);
    await setGoogleConfig(id, { sheetId });
    revalidatePath("/", "layout");
    return { ok: true, message: msg };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Couldn't read that sheet." };
  }
}

/** A receipt photo taken on the Connectors page: read by Claude and saved straight into the fridge. */
export async function snapReceipt(image: string): Promise<Result> {
  const id = await uid();
  if (typeof image !== "string" || !image || image.length > 6_000_000) return { ok: false, message: "That photo is too large." };
  const today = await runAsUser(id, async () => {
    const sql = await db();
    const [r] = await sql<{ n: number }[]>`select count(*)::int as n from grocery_runs where source = 'receipt' and created_at > now() - interval '1 day'`;
    return r.n;
  }).catch(() => 0);
  if (today >= 15) return { ok: false, message: "That's 15 receipts today. Try again tomorrow." };
  try {
    const draft = await readReceipt({ image: { data: image, mediaType: "image/jpeg" } });
    const items = draft.items.flatMap((i) => {
      const p = GroceryItemIn.safeParse(i);
      return p.success ? [p.data] : [];
    });
    if (!items.length) return { ok: false, message: "No food found on that receipt. Try a sharper photo." };
    await runAsUser(id, async () =>
      saveGroceryRun(await db(), {
        date: draft.date && /^\d{4}-\d{2}-\d{2}$/.test(draft.date) ? draft.date : todayISO(),
        store: draft.store.slice(0, 100),
        total: draft.total ?? undefined,
        source: "receipt",
        items,
      }),
    );
    await markConnected(id, "receipt", { via: "photo" });
    revalidatePath("/", "layout");
    return { ok: true, message: `Added ${items.length} item${items.length === 1 ? "" : "s"}${draft.store ? ` from ${draft.store}` : ""} to the fridge.` };
  } catch (e) {
    console.error("snapReceipt", e);
    return { ok: false, message: "Couldn't read that receipt. Try again, or a sharper photo." };
  }
}
