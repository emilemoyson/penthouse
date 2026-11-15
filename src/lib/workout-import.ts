import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { db } from "./db";
import { todayISO } from "./dates";
import { matchExercise, parseWorkoutNote, type ParsedSession } from "./parse-workout";

/**
 * Turns workout logs in any shape (an iPhone note, a Notion page, rows from an Excel or Google sheet)
 * into workouts and sets. The strict gym-template parser runs first; anything it can't read goes to Claude.
 * Re-importing from the same source replaces that source's sessions on the same days, so it is safe to resend.
 */

const Session = z.object({
  date: z.string().describe("YYYY-MM-DD. Use the year implied by today's date when the log omits it."),
  kind: z.enum(["push", "pull", "legs", "upper", "lower", "full", "other"]),
  notes: z.string().describe("Short free-text notes for the session, empty if none."),
  exercises: z.array(
    z.object({
      name: z.string().describe("Plain exercise name, e.g. 'Bench press', 'Lat pulldown'."),
      sets: z.array(
        z.object({
          weight: z.number().describe("0 for bodyweight."),
          unit: z.enum(["kg", "lb"]),
          reps: z.number().int(),
        }),
      ),
    }),
  ),
});
const Parsed = z.object({ sessions: z.array(Session) });

async function readWithClaude(text: string, hint: string): Promise<ParsedSession[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];
  const client = new Anthropic();
  const res = await client.beta.messages.parse({
    model: "claude-sonnet-5-5",
    max_tokens: 16000,
    output_config: { effort: "low", format: betaZodOutputFormat(Parsed) },
    system:
      "You read people's workout logs and return every strength session in them with its sets. Logs can be messy notes, tables or CSV rows. " +
      "One set per entry: '3x10 @ 60kg' is three sets of 10 at 60 kg. Skip cardio-only entries, plans for the future and anything without sets. " +
      "Use kg unless the log says lb or the numbers clearly are pounds. Never invent sets.",
    messages: [{ role: "user", content: `Today is ${todayISO()}. Source: ${hint}.\n\n${text.slice(0, 60_000)}` }],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) return [];
  return res.parsed_output.sessions
    .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.date) && s.exercises.length)
    .map((s) => ({
      date: s.date,
      kind: s.kind,
      notes: s.notes,
      exercises: s.exercises.map((e) => ({ ...matchExercise(e.name), sets: e.sets.map((st) => ({ ...st, alt: null })) })),
    }));
}

export async function importWorkoutText(text: string, source: string, opts: { sinceDays?: number; hint?: string } = {}) {
  if (!text.trim()) return { sessions: 0, message: "Nothing to read." };
  let { sessions } = parseWorkoutNote(text, todayISO());
  if (!sessions.length) sessions = await readWithClaude(text, opts.hint ?? source);
  if (opts.sinceDays) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - opts.sinceDays);
    const cut = d.toISOString().slice(0, 10);
    // the first import shows the last weeks; older history still counts if that's all there is
    const recent = sessions.filter((s) => s.date >= cut);
    if (recent.length) sessions = recent;
  }
  sessions = sessions.slice(-200);
  if (!sessions.length) return { sessions: 0, message: "No sets found in that log." };

  const sql = await db();
  await sql.begin(async (tx) => {
    for (const s of sessions) {
      await tx`delete from workouts where source = ${source} and date = ${s.date} and kind = ${s.kind}`;
      const [w] = await tx<{ id: number }[]>`insert into workouts (date, kind, notes, source) values (${s.date}, ${s.kind}, ${s.notes}, ${source}) returning id`;
      for (const [order, ex] of s.exercises.entries()) {
        if (!ex.known) await tx`insert into exercises (name) values (${ex.name}) on conflict (user_id, name) do nothing`;
        for (const [i, st] of ex.sets.entries()) {
          await tx`insert into sets (workout_id, exercise, ex_order, set_no, weight, unit, reps, reps_alt)
                   values (${w.id}, ${ex.name}, ${order}, ${i + 1}, ${st.weight}, ${st.unit}, ${st.reps}, ${st.alt})`;
        }
      }
    }
  });
  const sets = sessions.reduce((n, s) => n + s.exercises.reduce((m, e) => m + e.sets.length, 0), 0);
  return { sessions: sessions.length, message: `Saved ${sessions.length} session${sessions.length === 1 ? "" : "s"} (${sets} sets).` };
}
