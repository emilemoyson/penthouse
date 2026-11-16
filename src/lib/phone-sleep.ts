import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { db } from "./db";
import { todayISO } from "./dates";

/**
 * Sleep from the "Office" iPhone Shortcut. The Shortcut sends Apple Health sleep samples as plain lines
 * ("start | end | stage"), in whatever date format the phone uses. Claude groups them into nights.
 * Each night is an upsert on (user, date), so sending the same night again is safe.
 */

const Night = z.object({
  date: z.string().describe("YYYY-MM-DD of the morning the person woke up."),
  totalMin: z.number().int().describe("Minutes asleep (core + deep + REM, or 'Asleep'), not time in bed."),
  deepMin: z.number().int().nullable(),
  remMin: z.number().int().nullable(),
  lightMin: z.number().int().nullable().describe("Core sleep minutes."),
  awakeMin: z.number().int().nullable(),
  bedtime: z.string().nullable().describe("HH:MM when sleep started, 24h."),
  waketime: z.string().nullable().describe("HH:MM when sleep ended, 24h."),
});
const Parsed = z.object({ nights: z.array(Night) });

export async function ingestPhoneSleep(raw: string) {
  const t0 = raw.trim();
  // keep the newest samples if the backlog is long
  const text = t0.length > 40_000 ? t0.slice(t0.indexOf("\n", t0.length - 40_000) + 1) : t0;
  if (!text || !process.env.ANTHROPIC_API_KEY) return 0;
  const client = new Anthropic();
  const res = await client.beta.messages.parse({
    model: "claude-sonnet-5-5",
    max_tokens: 4000,
    output_config: { effort: "low", format: betaZodOutputFormat(Parsed) },
    system:
      "You get Apple Health sleep samples, one per line: start | end | stage (In Bed, Asleep, Core, Deep, REM, Awake). " +
      "Group them into nights and add up the minutes per stage. Ignore 'In Bed' when stage data exists. Never invent nights.",
    messages: [{ role: "user", content: `Today is ${todayISO()}.\n\n${text}` }],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) return 0;
  const sql = await db();
  const today = todayISO();
  let n = 0;
  for (const r of res.parsed_output.nights) {
    const d = new Date(`${r.date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== r.date || r.date > today) continue;
    if (r.totalMin <= 0 || r.totalMin > 1440) continue;
    const t = (s: string | null) => {
      const m = s ? /^(\d{1,2}):(\d{2})$/.exec(s) : null;
      return m && +m[1] < 24 && +m[2] < 60 ? s!.padStart(5, "0") : null;
    };
    const c = (v: number | null) => (v == null ? null : Math.min(1440, Math.max(0, v)));
    try {
      await sql`insert into sleep_logs (date, total_min, deep_min, rem_min, light_min, awake_min, bedtime, waketime, source, updated_at)
      values (${r.date}, ${r.totalMin}, ${c(r.deepMin)}, ${c(r.remMin)}, ${c(r.lightMin)}, ${c(r.awakeMin)}, ${t(r.bedtime)}, ${t(r.waketime)}, 'apple-watch', now())
      on conflict (user_id, date) do update set total_min = excluded.total_min, deep_min = excluded.deep_min, rem_min = excluded.rem_min,
        light_min = excluded.light_min, awake_min = excluded.awake_min, bedtime = excluded.bedtime, waketime = excluded.waketime,
        source = excluded.source, updated_at = now()
      where sleep_logs.source not in ('whoop', 'manual')`;
      n++;
    } catch {
      // skip a night the database rejects; the rest still save
    }
  }
  return n;
}
