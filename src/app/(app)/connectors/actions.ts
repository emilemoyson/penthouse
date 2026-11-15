"use server";

import { safeFetchText } from "@/lib/safe-fetch";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, getKV, rootSql, runAsUser, setKV } from "@/lib/db";
import { getUserId, supabaseServer } from "@/lib/session";
import { rotateIngestToken } from "@/lib/ingest-tokens";
import { importWorkoutText } from "@/lib/workout-import";
import { markConnected } from "@/lib/connectors/store";
import { byId } from "@/lib/connectors/catalog";
import { runSync, canSync } from "@/lib/connectors/sync";

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

export async function uploadSheet(_p: Result | undefined, form: FormData): Promise<Result> {
  const id = await uid();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, message: "Choose a file first." };
  if (file.size > 4_000_000) return { ok: false, message: "Keep it under 4 MB (export the last few months)." };
  let text = "";
  if (/\.(xlsx|xlsm)$/i.test(file.name)) {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await file.arrayBuffer()) as unknown as ArrayBuffer);
    const parts: string[] = [];
    wb.eachSheet((ws) => {
      const rows: string[] = [];
      ws.eachRow((row) => {
        const vals = (row.values as unknown[]).slice(1).map((v) => {
          if (v instanceof Date) return v.toISOString().slice(0, 10);
          if (v && typeof v === "object" && "result" in v) return String((v as { result: unknown }).result ?? "");
          if (v && typeof v === "object" && "text" in v) return String((v as { text: unknown }).text ?? "");
          return v == null ? "" : String(v);
        });
        rows.push(vals.join(" | "));
      });
      parts.push(`Sheet "${ws.name}"\n${rows.slice(-1500).join("\n")}`);
    });
    text = parts.join("\n\n");
  } else {
    text = (await file.text()).split("\n").slice(-1500).join("\n");
  }
  const res = await runAsUser(id, () => importWorkoutText(text, "sheet", { hint: `a spreadsheet called ${file.name}` }));
  if (res.sessions) await markConnected(id, "sheet", { file: file.name });
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
  if (!byId(connector)) return;
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
