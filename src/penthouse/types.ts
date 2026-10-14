export type PenthouseData = {
  today: string;
  training: {
    gymThisWeek: number;
    gymTarget: number;
    sinceLast: number | null;
    lastDate: string | null;
    sets28: number;
    runKmWeek: number;
    weeks: { label: string; gym: number }[];
    weeksHit: number; // weeks in the last 12 that hit the target
    heat: { date: string; on: boolean }[][]; // 8 weeks × 7 days
    lifts: { name: string; status: string; tone: "good" | "accent" | "warn" | "neutral"; top: string; change: number | null; advice: string }[];
    notes: { tone: string; title: string }[];
  } | null;
  jobs:
    | {
        ok: true;
        rows: { id: string; company: string; role: string; status: string; bucket: string; applied: string | null; deadline: string | null; link: string }[];
        appsThisWeek: number;
        appTarget: number;
        active: number;
        toApply: number;
        responseRate: number | null;
      }
    | { ok: false; message: string };
  events: { date: string; title: string; kind: string }[];
};
