"use server";

import { revalidatePath } from "next/cache";
import { db, getKV, setKV } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import type { Progress } from "@/lib/habits";

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const done = () => revalidatePath("/habits");

export async function saveHabit(date: string, patch: { read_min?: number | null; zetamac?: number | null; gym?: boolean; run?: boolean; note?: string }) {
  if (!isDate(date)) return;
  const sql = await db();
  const [cur] = await sql`select * from habit_logs where date = ${date}`;
  const next = {
    read_min: patch.read_min !== undefined ? patch.read_min : (cur?.read_min ?? null),
    zetamac: patch.zetamac !== undefined ? patch.zetamac : (cur?.zetamac ?? null),
    gym: patch.gym !== undefined ? patch.gym : (cur?.gym ?? false),
    run: patch.run !== undefined ? patch.run : (cur?.run ?? false),
    note: patch.note !== undefined ? patch.note.slice(0, 1000) : (cur?.note ?? ""),
  };
  await sql`insert into habit_logs (date, read_min, zetamac, gym, run, note)
            values (${date}, ${next.read_min}, ${next.zetamac}, ${next.gym}, ${next.run}, ${next.note})
            on conflict (date) do update set read_min = excluded.read_min, zetamac = excluded.zetamac,
              gym = excluded.gym, run = excluded.run, note = excluded.note`;
  done();
  revalidatePath("/training");
}

function stamp<T extends { history?: Record<string, number> }>(rec: T, total: number): T {
  return { ...rec, history: { ...(rec.history || {}), [todayISO()]: total } };
}

export async function toggleGuide(key: string) {
  const g = await getKV<Progress["guide"]>("guide", { done: {} });
  g.done = { ...g.done, [key]: !g.done[key] };
  await setKV("guide", g);
  done();
}
export async function setQuestions(level: number, value: number) {
  const q = await getKV<Progress["questions"]>("questions", { byLevel: {} });
  const byLevel = { ...q.byLevel, [level]: Math.max(0, Math.round(value) || 0) };
  const total = Object.values(byLevel).reduce<number>((a, b) => a + Number(b || 0), 0);
  await setKV("questions", stamp({ ...q, byLevel }, total));
  done();
}
export async function setLeetcode(level: "easy" | "medium" | "hard", value: number) {
  const l = await getKV<Progress["leetcode"]>("leetcode", {});
  const next = { ...l, [level]: Math.max(0, Math.round(value) || 0) };
  await setKV("leetcode", stamp(next, (next.easy || 0) + (next.medium || 0) + (next.hard || 0)));
  done();
}
export async function toggleCourse(key: string) {
  const d = await getKV<Progress["datacamp"]>("datacamp", { done: {} });
  d.done = { ...d.done, [key]: !d.done[key] };
  await setKV("datacamp", d);
  done();
}

export async function addBook(form: FormData) {
  const title = String(form.get("title") || "").trim().slice(0, 200);
  const author = String(form.get("author") || "").trim().slice(0, 120);
  if (!title) return;
  const sql = await db();
  await sql`insert into books (title, author, status) values (${title}, ${author}, 'reading')`;
  done();
}
export async function cycleBook(id: number) {
  const sql = await db();
  await sql`update books set status = case status when 'next' then 'reading' when 'reading' then 'finished' else 'next' end where id = ${id}`;
  done();
}
export async function deleteBook(id: number) {
  const sql = await db();
  await sql`delete from books where id = ${id}`;
  done();
}
