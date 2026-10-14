import { db, getKV } from "./db";

export type HabitLog = { date: string; read_min: number | null; zetamac: number | null; gym: boolean; run: boolean; note: string };
export type EventRow = { id: number; date: string; title: string; note: string; kind: string };
export type Book = { id: number; title: string; author: string; status: string };

export const GUIDE = [
  { sec: "Probability & Statistics", topics: ["Probability Distributions", "Formulas and Theorems", "Markov Chains"] },
  { sec: "Statistical Learning", topics: ["Linear Regression", "Classification", "Tree Methods"] },
  { sec: "Deep Learning", topics: ["Neural Networks", "Large Language Models"] },
  { sec: "Linear Algebra", topics: ["Matrix Algebra", "Matrix Decomposition"] },
  { sec: "Calculus", topics: ["Calculus Fundamentals"] },
  { sec: "Finance", topics: ["Market Making", "Options Theory", "Portfolio Theory"] },
];
export const GUIDE_TOTAL = GUIDE.reduce((a, s) => a + s.topics.length, 0);
export const QLEVELS: [number, number][] = [[1, 4], [2, 55], [3, 55], [4, 35], [5, 24], [6, 9], [7, 4], [8, 2], [9, 2], [10, 0]];
export const QTOTAL = 190;
export const LC: [string, number][] = [["Easy", 965], ["Medium", 2115], ["Hard", 975]];

export const CLAUDE = {
  start: "2026-09-15",
  courseTarget: "2026-10-25",
  projectOpen: "2026-11-01",
  testOpen: "2026-11-09",
  projectDue: "2026-11-12",
  close: "2026-11-15",
};
export const COURSES = [
  { slug: "claude-101", title: "Claude 101", group: "Foundations", hours: 2 },
  { slug: "analyzing-data-with-claude", title: "Analyzing Data with Claude", group: "Foundations", hours: 2.5 },
  { slug: "building-claude-cowork-plugins", title: "Building Claude Cowork Plugins", group: "Foundations", hours: 1.25 },
  { slug: "claude-code-101", title: "Claude Code 101", group: "Claude Code", hours: 3 },
  { slug: "introduction-to-agent-skills", title: "Introduction to Agent Skills", group: "Claude Code", hours: 2.5 },
  { slug: "introduction-to-subagents", title: "Introduction to Subagents", group: "Claude Code", hours: 2 },
  { slug: "claude-code-in-action", title: "Claude Code in Action", group: "Claude Code", hours: 3 },
  { slug: "software-development-with-claude-code", title: "Software Development with Claude Code", group: "Claude Code", hours: 4 },
  { slug: "introduction-to-claude-models", title: "Introduction to Claude Models", group: "Build with the API", hours: 3 },
  { slug: "model-context-protocol-advanced-topics", title: "Model Context Protocol: Advanced Topics", group: "Build with the API", hours: 3 },
];
export const C_HOURS = COURSES.reduce((a, c) => a + c.hours, 0);

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export type Progress = {
  guide: { done: Record<string, boolean> };
  questions: { byLevel: Record<string, number>; history?: Record<string, number> };
  leetcode: { easy?: number; medium?: number; hard?: number; history?: Record<string, number> };
  datacamp: { done: Record<string, boolean> };
};

export async function loadHabits() {
  const sql = await db();
  const [logs, events, books, workoutDays, runDays, guide, questions, leetcode, datacamp] = await Promise.all([
    sql<HabitLog[]>`select date, read_min, zetamac, gym, run, note from habit_logs order by date`,
    sql<EventRow[]>`select id, date, title, note, kind from events order by date`,
    sql<Book[]>`select id, title, author, status from books order by created_at`,
    sql<{ date: string }[]>`select distinct date from workouts`,
    sql<{ date: string }[]>`select distinct date from runs`,
    getKV<Progress["guide"]>("guide", { done: {} }),
    getKV<Progress["questions"]>("questions", { byLevel: {} }),
    getKV<Progress["leetcode"]>("leetcode", {}),
    getKV<Progress["datacamp"]>("datacamp", { done: {} }),
  ]);
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const gymDays = new Set([...workoutDays.map((r) => r.date), ...logs.filter((l) => l.gym).map((l) => l.date)]);
  const runSet = new Set([...runDays.map((r) => r.date), ...logs.filter((l) => l.run).map((l) => l.date)]);
  const autoGym = new Set(workoutDays.map((r) => r.date));
  const autoRun = new Set(runDays.map((r) => r.date));
  return {
    logs: [...logs],
    byDate,
    events: [...events],
    books: [...books],
    gymDays,
    runSet,
    autoGym,
    autoRun,
    progress: { guide, questions, leetcode, datacamp } as Progress,
  };
}
export type HabitsData = Awaited<ReturnType<typeof loadHabits>>;
