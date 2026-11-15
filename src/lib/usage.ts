import { db } from "./db";
import { todayISO } from "./dates";

const CAP = Number(process.env.DAILY_CHAT_CAP || 40);

/** Counts one chat message for the signed-in user today. False once they're over the daily cap. */
export async function takeChat(): Promise<boolean> {
  const sql = await db();
  const [r] = await sql<{ chats: number }[]>`
    insert into usage_daily (date, chats) values (${todayISO()}, 1)
    on conflict (user_id, date) do update set chats = usage_daily.chats + 1
    returning chats`;
  return r.chats <= CAP;
}
