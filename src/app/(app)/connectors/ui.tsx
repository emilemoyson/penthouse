"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import clsx from "clsx";
import { Check, Copy, RefreshCw, Plug, Smartphone, Upload, ClipboardPaste, BookOpen, KeyRound } from "lucide-react";
import type { Connector } from "@/lib/connectors/catalog";
import {
  deleteAccount, disconnect, markSetUp, newKey, pasteNotes, requestConnector, saveCalendar, saveHevyKey, saveProfile, syncNow, uploadSheet,
} from "./actions";

export type Status = { connected: boolean; account: string | null; lastSync: string | null; error: string | null };

const ago = (iso: string | null) => {
  if (!iso) return "not yet";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
};

const METHOD: Record<Connector["method"], { label: string; icon: typeof Plug }> = {
  google: { label: "Log in once", icon: Plug },
  oauth: { label: "Log in once", icon: Plug },
  key: { label: "Paste a key", icon: KeyRound },
  phone: { label: "iPhone setup", icon: Smartphone },
  upload: { label: "Upload", icon: Upload },
  paste: { label: "Paste a link", icon: ClipboardPaste },
  guide: { label: "Through Strava", icon: BookOpen },
};

const btn = "inline-flex h-8 items-center justify-center gap-1.5 rounded-[9px] px-3 text-[13px] font-medium transition disabled:opacity-60";
const primary = clsx(btn, "bg-ink text-bg hover:opacity-90");
const quiet = clsx(btn, "border border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink");

export function Banner({ connected, error }: { connected?: string; error?: string }) {
  if (!connected && !error) return null;
  const raw = connected ?? "";
  const cut = raw.indexOf(":");
  const id = cut < 0 ? raw : raw.slice(0, cut);
  const msg = cut < 0 ? "" : raw.slice(cut + 1);
  return (
    <div className={clsx("rounded-xl border px-4 py-3 text-[14px]", error ? "border-bad/30 bg-bad-soft text-bad" : "border-good/30 bg-good-soft text-ink")}>
      {error ? error : `Connected ${id}. Brought in ${msg || "your recent data"}. Your rooms are updated.`}
    </div>
  );
}

export function ConnectorCard({ c, status, live, hasKey, calendarUrls }: { c: Connector; status: Status | null; live: boolean; hasKey: boolean; calendarUrls?: string[] }) {
  const M = METHOD[c.method];
  const on = !!status?.connected;
  return (
    <div className={clsx("flex flex-col gap-3 rounded-2xl border bg-surface p-4", on ? "border-good/40" : "border-line")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[15px] font-semibold">{c.name}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[11.5px] text-ink-3">
            <M.icon size={12} /> {M.label}
          </div>
        </div>
        {on && (
          <span className="inline-flex items-center gap-1 rounded-full bg-good-soft px-2 py-0.5 text-[11.5px] font-medium text-good">
            <Check size={12} /> Connected
          </span>
        )}
      </div>
      <p className="text-[13px] leading-relaxed text-ink-2">{c.blurb}</p>
      <p className="text-[12px] text-ink-3">Feeds: {c.feeds}</p>
      {on && (status?.account || status?.lastSync || status?.error) && (
        <p className={clsx("text-[12px]", status?.error ? "text-bad" : "text-ink-3")}>
          {status?.error ? `Last sync failed: ${status.error}` : `${status?.account ? `${status.account}. ` : ""}Updated ${ago(status?.lastSync ?? null)}.`}
        </p>
      )}
      <div className="mt-auto">
        <Body c={c} on={on} live={live} hasKey={hasKey} calendarUrls={calendarUrls} />
      </div>
    </div>
  );
}

function Body({ c, on, live, hasKey, calendarUrls }: { c: Connector; on: boolean; live: boolean; hasKey: boolean; calendarUrls?: string[] }) {
  switch (c.method) {
    case "oauth":
    case "google":
      return on ? <Connected id={c.id} canSync /> : live ? (
        <a href={`/api/connect/${c.id}`} className={primary}>Connect {c.name}</a>
      ) : null;
    case "key":
      return <HevyForm on={on} />;
    case "phone":
      return c.id === "apple-health" ? <HealthSetup on={on} hasKey={hasKey} /> : <NotesSetup on={on} hasKey={hasKey} />;
    case "upload":
      return c.id === "sheet" ? <SheetUpload on={on} /> : <Link href="/kitchen" className={quiet}>Open the Kitchen to add a receipt</Link>;
    case "paste":
      return <CalendarForm urls={calendarUrls ?? []} on={on} />;
    case "guide":
      return <GarminGuide on={on} />;
  }
}

export function Connected({ id, canSync }: { id: string; canSync?: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {canSync && (
          <button className={quiet} disabled={pending} onClick={() => start(async () => setMsg((await syncNow(id)).message))}>
            <RefreshCw size={13} className={pending ? "animate-spin" : ""} /> Sync now
          </button>
        )}
        <button className={quiet} disabled={pending} onClick={() => start(() => disconnect(id))}>Disconnect</button>
      </div>
      {msg && <p className="text-[12px] text-ink-3">{msg}</p>}
    </div>
  );
}

function Copyable({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); })}
      className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-left font-mono text-[11.5px] text-ink-2 hover:text-ink"
    >
      <span className="min-w-0 flex-1 truncate">{value}</span>
      {done ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function KeyMaker({ hasKey }: { hasKey: boolean }) {
  const [key, setKey] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (key)
    return (
      <div className="space-y-1">
        <div className="text-[12px] text-ink-3">Your personal key (shown once, keep it private):</div>
        <Copyable value={key} />
      </div>
    );
  return (
    <button className={quiet} disabled={pending} onClick={() => start(async () => setKey((await newKey()).token ?? null))}>
      {hasKey ? "Make a new key (the old one stops)" : "Make my personal key"}
    </button>
  );
}

const origin = () => (typeof window === "undefined" ? "" : window.location.origin);

function HealthSetup({ on, hasKey }: { on: boolean; hasKey: boolean }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <div className="flex flex-wrap gap-2">
        <button className={on ? quiet : primary} onClick={() => setOpen(true)}>{on ? "Show setup" : "Set up (2 min)"}</button>
        {on && <Connected id="apple-health" />}
      </div>
    );
  return (
    <ol className="list-decimal space-y-2 pl-4 text-[12.5px] leading-relaxed text-ink-2">
      <li><KeyMaker hasKey={hasKey} /></li>
      <li>On your iPhone, install <a className="underline" href="https://apps.apple.com/app/health-auto-export-json-csv/id1115567069" target="_blank" rel="noreferrer">Health Auto Export</a> and allow Health access.</li>
      <li>
        Automations, new, REST API. URL:
        <Copyable value={`${origin()}/api/ingest/health`} />
        Add a header <b>Authorization</b> with the value <b>Bearer</b> followed by a space and your key. Format JSON.
      </li>
      <li>Data: Sleep Analysis, Step Count, Active Energy and Workouts. Sync cadence: hourly. Tap Manual Export once with the last 14 days.</li>
      <li><button className={primary} onClick={() => markSetUp("apple-health")}>{on ? "Done" : "I've set it up"}</button></li>
    </ol>
  );
}

function NotesSetup({ on, hasKey }: { on: boolean; hasKey: boolean }) {
  const [state, action, pending] = useActionState(pasteNotes, undefined);
  const [shortcut, setShortcut] = useState(false);
  return (
    <div className="space-y-2">
      <form action={action} className="space-y-2">
        <textarea name="text" rows={4} className="field min-h-[90px] text-[12.5px]" placeholder={"Paste your workout note here.\nAny layout works, e.g.\nMon 10 Nov Push\nBench 60kg 3x8"} />
        <button className={primary} disabled={pending}>{pending ? "Reading…" : "Read my note"}</button>
      </form>
      {state && <p className={clsx("text-[12px]", state.ok ? "text-good" : "text-bad")}>{state.message}</p>}
      <button className="text-[12.5px] font-medium text-ink-2 underline-offset-2 hover:underline" onClick={() => setShortcut(!shortcut)}>
        {shortcut ? "Hide" : "Keep it in sync with a Shortcut"}
      </button>
      {shortcut && (
        <ol className="list-decimal space-y-2 pl-4 text-[12.5px] leading-relaxed text-ink-2">
          <li><KeyMaker hasKey={hasKey} /></li>
          <li>
            On your iPhone, open <b>Shortcuts</b>, tap <b>+</b> and add two actions:
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li><b>Find Notes</b> where Name is your workout note (this is how the Office knows which note). Limit 1.</li>
              <li><b>Get Contents of URL</b>, method <b>POST</b>, to
                <Copyable value={`${origin()}/api/ingest/notes`} />
                Headers: <b>Authorization</b> = <b>Bearer</b>, a space, then your key. Request Body: <b>JSON</b>, key <b>text</b>, value the Notes from the step above.</li>
            </ul>
          </li>
          <li>Name it <b>Send to Office</b> and run it once. The Gym fills in.</li>
          <li>Make it automatic: Shortcuts, <b>Automation</b>, <b>+</b>, <b>Time of Day</b> 9 pm daily, <b>Run Immediately</b>, choose Send to Office.</li>
        </ol>
      )}
      {on && <Connected id="apple-notes" />}
    </div>
  );
}

function SheetUpload({ on }: { on: boolean }) {
  const [state, action, pending] = useActionState(uploadSheet, undefined);
  return (
    <div className="space-y-2">
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input name="file" type="file" accept=".xlsx,.xlsm,.csv,.tsv,.txt" className="max-w-full text-[12px] file:mr-2 file:rounded-md file:border file:border-line file:bg-surface-2 file:px-2 file:py-1 file:text-[12px]" />
        <button className={primary} disabled={pending}>{pending ? "Reading…" : "Upload"}</button>
      </form>
      <p className="text-[11.5px] text-ink-3">Google Sheets: File, Download, Microsoft Excel (.xlsx), then upload it here.</p>
      {state && <p className={clsx("text-[12px]", state.ok ? "text-good" : "text-bad")}>{state.message}</p>}
      {on && <Connected id="sheet" />}
    </div>
  );
}

function CalendarForm({ urls, on }: { urls: string[]; on: boolean }) {
  const [state, action, pending] = useActionState(saveCalendar, undefined);
  return (
    <form action={action} className="space-y-2">
      <textarea name="urls" rows={2} defaultValue={urls.join("\n")} className="field min-h-[60px] font-mono text-[11.5px]" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" />
      <details className="text-[11.5px] text-ink-3">
        <summary className="cursor-pointer">Where do I find it?</summary>
        Google: Settings, your calendar, Integrate calendar, Secret address in iCal format. Outlook: Settings, Calendar, Shared calendars, Publish, ICS link. iCloud: share the calendar as Public and copy the link.
      </details>
      <button className={on ? quiet : primary} disabled={pending}>{pending ? "Checking…" : on ? "Update" : "Save calendar"}</button>
      {state && <p className={clsx("text-[12px]", state.ok ? "text-good" : "text-bad")}>{state.message}</p>}
    </form>
  );
}

function GarminGuide({ on }: { on: boolean }) {
  return (
    <div className="space-y-2 text-[12.5px] text-ink-2">
      <ol className="list-decimal space-y-1 pl-4">
        <li>Garmin Connect app: More, Settings, Connected Apps, Strava, allow.</li>
        <li>Connect Strava above. Garmin runs and workouts then arrive here on their own.</li>
      </ol>
      {on ? <Connected id="garmin" /> : <button className={quiet} onClick={() => markSetUp("garmin")}>Done</button>}
    </div>
  );
}

function HevyForm({ on }: { on: boolean }) {
  const [state, action, pending] = useActionState(saveHevyKey, undefined);
  if (on) return <Connected id="hevy" canSync />;
  return (
    <form action={action} className="space-y-2">
      <input name="key" className="field font-mono text-[12px]" placeholder="Hevy API key" autoComplete="off" maxLength={80} />
      <button className={primary} disabled={pending}>{pending ? "Checking…" : "Connect Hevy"}</button>
      {state && <p className={clsx("text-[12px]", state.ok ? "text-good" : "text-bad")}>{state.message}</p>}
    </form>
  );
}

export function RequestForm() {
  const [state, action, pending] = useActionState(requestConnector, undefined);
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-line bg-surface p-5">
      <div>
        <h2 className="font-serif text-[19px] font-medium">Missing something?</h2>
        <p className="text-[13px] text-ink-2">Name the app or device you use. It goes to Emile as a request, and Claude drafts the connector for them to review.</p>
      </div>
      <input name="name" className="field" placeholder="e.g. Oura, Hevy, Lose It!" maxLength={80} />
      <textarea name="detail" rows={2} className="field text-[13px]" placeholder="What should it bring in? (optional)" maxLength={1000} />
      <button className={primary} disabled={pending}>{pending ? "Sending…" : "Request it"}</button>
      {state && <p className={clsx("text-[12.5px]", state.ok ? "text-good" : "text-bad")}>{state.message}</p>}
    </form>
  );
}

const ZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Madrid", "Europe/Paris", "Europe/Amsterdam", "Asia/Dubai", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"];

export function ProfileForm({ name, timezone }: { name: string; timezone: string }) {
  const [state, action, pending] = useActionState(saveProfile, undefined);
  const zones = ZONES.includes(timezone) ? ZONES : [timezone, ...ZONES];
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-line bg-surface p-5">
      <div>
        <h2 className="font-serif text-[19px] font-medium">You</h2>
        <p className="text-[13px] text-ink-2">The rooms greet you by name and follow your time zone.</p>
      </div>
      <input name="name" defaultValue={name} className="field" placeholder="First name" maxLength={60} />
      <select name="timezone" defaultValue={timezone} className="field">
        {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
      </select>
      <button className={primary} disabled={pending}>{pending ? "Saving…" : "Save"}</button>
      {state && <p className={clsx("text-[12.5px]", state.ok ? "text-good" : "text-bad")}>{state.message}</p>}
    </form>
  );
}

export function DeleteAccount({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl border border-line p-5 text-[13px] text-ink-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>
          Signed in as <b>{email}</b>. Your data is only visible to you. Connector tokens are stored encrypted.
        </p>
        <button className="text-[12.5px] text-bad underline-offset-2 hover:underline" onClick={() => setOpen(!open)}>Delete my account and data</button>
      </div>
      {open && (
        <form action={deleteAccount} className="mt-3 flex flex-wrap items-center gap-2">
          <span>This removes everything and can&apos;t be undone. Type <b>delete</b>:</span>
          <input name="confirm" className="field h-8 w-32" autoComplete="off" />
          <button className={clsx(btn, "bg-bad text-white")}>Delete</button>
        </form>
      )}
    </section>
  );
}
