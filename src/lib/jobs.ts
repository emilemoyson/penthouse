import { readFile } from "node:fs/promises";
import { addDays, daysBetween, looseDate, mondayOf, todayISO, fShort } from "./dates";

export type Job = {
  id: string;
  dateAdded: string | null;
  datePosted: string | null;
  dateApplied: string | null;
  bucket: string;
  company: string;
  status: string;
  role: string;
  level: string;
  eligible: string;
  location: string;
  link: string;
  deadline: string | null;
  lastUpdate: string | null;
};
export type Contact = {
  id: string;
  name: string;
  title: string;
  company: string;
  bucket: string;
  priority: string;
  status: string;
  dateSent: string | null;
  followUp: string | null;
  linkedin: string;
  message: string;
  notes: string;
};
export type JobsSettings = { appTarget: number; outreachTarget: number; ghostDays: number; followUpDays: number };

export type JobsResult =
  | { ok: true; jobs: Job[]; contacts: Contact[]; settings: JobsSettings; updatedAt: string; demo: boolean }
  | { ok: false; reason: "not_configured" | "error"; message?: string };

export const STAGES = ["To apply", "Applied", "To do assessment", "Assessment complete", "Interview", "Final round", "Offer"] as const;
export const CLOSED = ["Rejected", "Ghosted", "Withdrawn", "Closed"] as const;
export const ACTIVE = ["Applied", "To do assessment", "Assessment complete", "Interview", "Final round"] as const;
const PAST_APPLIED = ["Applied", "To do assessment", "Assessment complete", "Interview", "Final round", "Offer", "Rejected", "Ghosted", "Withdrawn"];
const RESPONDED = ["To do assessment", "Assessment complete", "Interview", "Final round", "Offer", "Rejected"];

export const SHEET_URL = process.env.JOBS_SHEET_VIEW_URL || "https://docs.google.com/spreadsheets/d/1B29Ar9z4ST2Rj80lBqSj0PsWVpKO60DO-sl97y40MkU/edit";

type Raw = { updatedAt?: string; jobs?: Record<string, string>[]; outreach?: Record<string, string>[]; settings?: Record<string, string>; error?: string };

const clean = (v: unknown) => {
  const s = String(v ?? "").trim();
  return /^(n\/a|not applied yet|-|–)$/i.test(s) ? "" : s;
};

function normalise(raw: Raw): { jobs: Job[]; contacts: Contact[]; settings: JobsSettings } {
  const jobs: Job[] = (raw.jobs || [])
    .filter((r) => clean(r["Job ID"]) || clean(r["Company"]))
    .map((r) => ({
      id: clean(r["Job ID"]),
      dateAdded: looseDate(clean(r["Date added"])),
      datePosted: looseDate(clean(r["Date posted"])),
      dateApplied: looseDate(clean(r["Date applied"])),
      bucket: clean(r["Bucket"]) || "Unsorted",
      company: clean(r["Company"]),
      status: clean(r["Status"]) || "To apply",
      role: clean(r["Role"]),
      level: clean(r["Level"]),
      eligible: clean(r["Eligible?"]),
      location: clean(r["Location"]),
      link: clean(r["Apply link"]),
      deadline: looseDate(clean(r["Deadline"])),
      lastUpdate: looseDate(clean(r["Last update"])),
    }));
  const contacts: Contact[] = (raw.outreach || [])
    .filter((r) => clean(r["Name"]))
    .map((r) => ({
      id: clean(r["Contact ID"]),
      name: clean(r["Name"]),
      title: clean(r["Title"]),
      company: clean(r["Company"]),
      bucket: clean(r["Bucket"]),
      priority: clean(r["Priority"]),
      status: clean(r["Status"]) || "To send",
      dateSent: looseDate(clean(r["Date sent"])),
      followUp: looseDate(clean(r["Follow-up date"])),
      linkedin: clean(r["LinkedIn URL"]),
      message: clean(r["Message draft"]),
      notes: clean(r["Notes"]),
    }));
  const s = raw.settings || {};
  const num = (k: string, d: number) => {
    const v = Number(s[k]);
    return isFinite(v) && v > 0 ? v : d;
  };
  return {
    jobs,
    contacts,
    settings: {
      appTarget: num("Weekly application target", 10),
      outreachTarget: num("Weekly cold outreach target", 10),
      ghostDays: num("Mark as Ghosted after this many days without news", 21),
      followUpDays: num("Follow up on an outreach message after (days)", 7),
    },
  };
}

export async function loadJobs(): Promise<JobsResult> {
  const fixture = process.env.JOBS_FIXTURE;
  if (fixture) {
    const raw = JSON.parse(await readFile(fixture, "utf8")) as Raw;
    return { ok: true, ...normalise(raw), updatedAt: raw.updatedAt || new Date().toISOString(), demo: true };
  }
  const url = process.env.JOBS_SHEET_URL;
  const token = process.env.JOBS_SHEET_TOKEN;
  if (!url || !token) return { ok: false, reason: "not_configured" };
  try {
    const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`, {
      next: { revalidate: 300, tags: ["jobs"] },
      redirect: "follow",
    });
    if (!res.ok) return { ok: false, reason: "error", message: `The sheet answered with ${res.status}.` };
    const raw = (await res.json()) as Raw;
    if (raw.error) return { ok: false, reason: "error", message: raw.error === "unauthorized" ? "The token doesn't match the one in the sheet's script." : raw.error };
    return { ok: true, ...normalise(raw), updatedAt: raw.updatedAt || new Date().toISOString(), demo: false };
  } catch (e) {
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : "Couldn't reach the sheet." };
  }
}

/* ------------------------------------------------------------------ */

export function jobAnalytics(jobs: Job[], contacts: Contact[], settings: JobsSettings, today = todayISO()) {
  const monday = mondayOf(today);
  const applied = jobs.filter((j) => PAST_APPLIED.includes(j.status));
  const appsThisWeek = jobs.filter((j) => j.dateApplied && j.dateApplied >= monday && j.dateApplied <= today).length;
  const outreachThisWeek = contacts.filter((c) => c.dateSent && c.dateSent >= monday && c.dateSent <= today).length;
  const active = jobs.filter((j) => (ACTIVE as readonly string[]).includes(j.status));
  const interviews = jobs.filter((j) => ["Interview", "Final round"].includes(j.status)).length;
  const responded = jobs.filter((j) => RESPONDED.includes(j.status)).length;
  const responseRate = applied.length ? responded / applied.length : null;

  const stageCounts = [...STAGES, ...CLOSED].map((s) => ({ status: s, count: jobs.filter((j) => j.status === s).length }));

  const weeks = Array.from({ length: 8 }, (_, i) => addDays(monday, -7 * (7 - i))).map((m) => ({
    week: m,
    label: fShort(m),
    apps: jobs.filter((j) => j.dateApplied && mondayOf(j.dateApplied) === m).length,
    outreach: contacts.filter((c) => c.dateSent && mondayOf(c.dateSent) === m).length,
  }));

  const buckets = [...new Set(jobs.map((j) => j.bucket))].sort().map((b) => {
    const js = jobs.filter((j) => j.bucket === b);
    return {
      bucket: b.replace(/^\d+\s*/, ""),
      tracked: js.length,
      toApply: js.filter((j) => j.status === "To apply").length,
      applied: js.filter((j) => PAST_APPLIED.includes(j.status)).length,
      active: js.filter((j) => (ACTIVE as readonly string[]).includes(j.status)).length,
      rejected: js.filter((j) => j.status === "Rejected").length,
      contacts: contacts.filter((c) => c.bucket === b).length,
    };
  });

  // Next actions
  const toApply = jobs
    .filter((j) => j.status === "To apply")
    .map((j) => ({ ...j, daysLeft: j.deadline ? daysBetween(today, j.deadline) : null, age: j.datePosted ? daysBetween(j.datePosted, today) : null }))
    .sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999) || (a.age ?? 999) - (b.age ?? 999));
  const stale = active
    .filter((j) => {
      const ref = j.lastUpdate || j.dateApplied;
      return ref && daysBetween(ref, today) >= settings.ghostDays;
    })
    .map((j) => ({ ...j, days: daysBetween((j.lastUpdate || j.dateApplied)!, today) }));
  const followUps = contacts.filter((c) => c.status === "Sent" && c.followUp && c.followUp <= today);
  const toSend = contacts.filter((c) => c.status === "To send");
  const missingDates = jobs.filter((j) => PAST_APPLIED.includes(j.status) && !j.dateApplied);
  const oldPostings = toApply.filter((j) => j.age != null && j.age > 120);

  return {
    appsThisWeek,
    outreachThisWeek,
    applied: applied.length,
    active: active.length,
    interviews,
    responseRate,
    responded,
    stageCounts,
    weeks,
    buckets,
    toApply,
    stale,
    followUps,
    toSend,
    missingDates,
    oldPostings,
  };
}
