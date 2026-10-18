import { DEFAULT_EXERCISES, SESSION_KINDS } from "./exercises";

/**
 * Reads a gym note written with the template in docs/gym-template.md:
 *
 *   Push                 ← optional title: the workout kind
 *   Sat 17 Oct           ← a date line starts a session (a type word may follow it)
 *   Flat DB press        ← exercise: a line without digits
 *   50 x 8               ← one set per line: weight x reps
 *   BW x 10              ← bodyweight (a bare "10" works too)
 *   12.5 x 14/14         ← left/right reps
 *   Notes: felt strong
 *
 * Lenient with the older style too ("45lb x 9 x 9 x 7" = three sets, "12 (11)" = left/right).
 * Anything it can't read comes back in `skipped`, never silently dropped.
 */

export type ParsedSet = { weight: number; unit: "lb" | "kg"; reps: number; alt: number | null };
export type ParsedExercise = { name: string; known: boolean; sets: ParsedSet[] };
export type ParsedSession = { date: string; kind: string; notes: string; exercises: ParsedExercise[] };
export type ParseResult = { sessions: ParsedSession[]; skipped: string[] };

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const KIND_WORDS: Record<string, string> = Object.fromEntries([
  ...SESSION_KINDS.map((k) => [k.label.toLowerCase(), k.id]),
  ...SESSION_KINDS.map((k) => [k.id, k.id]),
  ["leg", "legs"],
  ["full", "full"],
]);

/* ---------- dates ---------- */

const MON = "(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const DOW = "(?:(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\\.?,?\\s+)?";
const DAY_MON = new RegExp(`^${DOW}(\\d{1,2})(?:st|nd|rd|th)?\\s+${MON},?(?:\\s+(\\d{4}))?(?:\\s+(.*))?$`, "i");
const MON_DAY = new RegExp(`^${DOW}${MON}\\s+(\\d{1,2})(?:st|nd|rd|th)?,?(?:\\s+(\\d{4}))?(?:\\s+(.*))?$`, "i");
const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:\s+(.*))?$/;

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** "Sat 17 Oct" → the most recent 17 Oct on or before today (a day of slack for time zones). */
function withYear(month: number, day: number, year: number | null, today: string) {
  if (year) return iso(year, month, day);
  const y = Number(today.slice(0, 4));
  const guess = iso(y, month, day);
  const limit = new Date(today + "T12:00:00Z");
  limit.setUTCDate(limit.getUTCDate() + 1);
  return guess <= limit.toISOString().slice(0, 10) ? guess : iso(y - 1, month, day);
}

function parseDateLine(line: string, today: string): { date: string; rest: string } | null {
  let m = line.match(ISO);
  if (m) return { date: iso(+m[1], +m[2], +m[3]), rest: m[4] ?? "" };
  m = line.match(DAY_MON);
  if (m) {
    const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
    const day = +m[1];
    if (day >= 1 && day <= 31) return { date: withYear(month, day, m[3] ? +m[3] : null, today), rest: m[4] ?? "" };
  }
  m = line.match(MON_DAY);
  if (m) {
    const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    const day = +m[2];
    if (day >= 1 && day <= 31) return { date: withYear(month, day, m[3] ? +m[3] : null, today), rest: m[4] ?? "" };
  }
  return null;
}

/* ---------- sets ---------- */

const WEIGHT = /^(bw|bodyweight|\d+(?:\.\d+)?)\s*(lbs?|kgs?|kb)?\s*(?:x|×|\*)\s*(.+)$/i;
const REPS = /^(\d+)\s*(?:\/\s*(\d+)|\(\s*(\d+)\s*\))?$/;

function parseReps(part: string): { reps: number; alt: number | null }[] | null {
  // "9 x 9 x 7", "9, 9, 7", "9 9 7", "14/14", "12 (11) x 14(14)"
  const items = part
    .replace(/\(\s*/g, "(")
    .replace(/\s*\)/g, ")")
    .replace(/(\d)\s*\(/g, "$1(")
    .split(/\s*(?:x|×|,|\s)\s*/i)
    .filter(Boolean);
  const out: { reps: number; alt: number | null }[] = [];
  for (const it of items) {
    const m = it.match(REPS);
    if (!m) return null;
    const alt = m[2] ?? m[3];
    out.push({ reps: +m[1], alt: alt != null ? +alt : null });
  }
  return out.length ? out : null;
}

function parseSetLine(line: string): ParsedSet[] | null {
  const w = line.match(WEIGHT);
  if (w) {
    const bw = /^b/i.test(w[1]);
    const unit: "lb" | "kg" = /^kg/i.test(w[2] ?? "") ? "kg" : "lb"; // only an explicit "kg" switches unit ("kb" typos stay lb)
    const reps = parseReps(w[3]);
    if (!reps) return null;
    return reps.map((r) => ({ weight: bw ? 0 : +w[1], unit, ...r }));
  }
  const reps = parseReps(line);
  return reps ? reps.map((r) => ({ weight: 0, unit: "lb" as const, ...r })) : null;
}

/* ---------- exercise names ---------- */

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[()\-_.,:]/g, " ")
    .replace(/\bdumbbells?\b/g, "db")
    .replace(/\bpull\s+downs?\b/g, "pulldown")
    .replace(/\bpush\s+downs?\b/g, "pushdown")
    .replace(/\bpull\s+ups?\b|\bpullups?\b/g, "pullup")
    .replace(/\bflys\b|\bflies\b/g, "fly")
    .replace(/\blat\s+raises?\b/g, "lateral raise")
    .replace(/\bincl\w*\b|\binclude\b/g, "incline")
    .replace(/\b(\w{3,}?)s\b/g, "$1") // crude plural strip (rows → row); library names go through the same function
    .split(/\s+/)
    .filter(Boolean);

const LIBRARY = DEFAULT_EXERCISES.filter((e) => e.name !== "Dumbbell (unnamed)").map((e) => ({ name: e.name, tokens: new Set(norm(e.name)) }));

/** Best match from the exercise library, or the name as written. */
export function matchExercise(raw: string): { name: string; known: boolean } {
  const t = new Set(norm(raw));
  if (!t.size) return { name: raw.trim(), known: false };
  if (t.size === 1 && t.has("db")) return { name: "Dumbbell (unnamed)", known: true };
  let best: { name: string; score: number } | null = null;
  for (const e of LIBRARY) {
    const inter = [...t].filter((x) => e.tokens.has(x)).length;
    const score = inter / new Set([...t, ...e.tokens]).size;
    if (!best || score > best.score) best = { name: e.name, score };
  }
  if (best && best.score >= 0.6) return { name: best.name, known: true };
  // "DB press (flat)" style where the extra word was dropped ("DB press" → Flat DB press)
  if (t.has("db") && t.has("press") && t.size === 2) return { name: "Flat DB press", known: true };
  const name = raw.trim().replace(/\s+/g, " ");
  return { name: name.charAt(0).toUpperCase() + name.slice(1), known: false };
}

/* ---------- note ---------- */

export function parseWorkoutNote(text: string, today: string): ParseResult {
  const sessions: ParsedSession[] = [];
  const skipped: string[] = [];
  let titleKind = "other";
  let session: ParsedSession | null = null;
  let exercise: ParsedExercise | null = null;

  const startSession = (date: string, kind: string) => {
    session = { date, kind, notes: "", exercises: [] };
    sessions.push(session);
    exercise = null;
  };
  const current = (): ParsedSession => {
    if (!session) startSession(today, titleKind); // a note without dates is today's session
    return session!;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^[-•*]\s*/, "");
    if (!line || /^x$/i.test(line)) continue;

    const kindWord = KIND_WORDS[line.toLowerCase()];
    if (kindWord) {
      // a type line before any session is the note's title; after a date it sets that session's kind
      if (session && !(session as ParsedSession).exercises.length) (session as ParsedSession).kind = kindWord;
      else titleKind = kindWord;
      continue;
    }

    const d = parseDateLine(line, today);
    if (d) {
      startSession(d.date, KIND_WORDS[d.rest.trim().toLowerCase()] ?? titleKind);
      continue;
    }

    const note = line.match(/^notes?\s*:\s*(.*)$/i);
    if (note) {
      const s = current();
      s.notes = [s.notes, note[1]].filter(Boolean).join(" ");
      continue;
    }

    if (/^\d|^bw\b|^bodyweight\b/i.test(line)) {
      const sets = parseSetLine(line);
      if (sets && exercise) (exercise as ParsedExercise).sets.push(...sets);
      else skipped.push(exercise ? line : `${line} (no exercise above it)`);
      continue;
    }

    if (!/\d/.test(line)) {
      const s = current();
      const m = matchExercise(line);
      // the same exercise written twice in one session keeps adding sets to it
      exercise = s.exercises.find((e) => e.name === m.name) ?? null;
      if (!exercise) {
        exercise = { ...m, sets: [] };
        s.exercises.push(exercise);
      }
      continue;
    }

    // unreadable exercise line: don't pin the sets below it on the previous exercise
    skipped.push(line);
    exercise = null;
  }

  for (const s of sessions) s.exercises = s.exercises.filter((e) => e.sets.length);
  return { sessions: sessions.filter((s) => s.exercises.length), skipped };
}
