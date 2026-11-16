"use client";

import { useActionState, useState, useTransition } from "react";
import clsx from "clsx";
import { Check, Copy, RefreshCw, Plug, Smartphone, Camera, ClipboardPaste, BookOpen, Table2 } from "lucide-react";
import type { Connector } from "@/lib/connectors/catalog";
import {
  deleteAccount, disconnect, markSetUp, newKey, pasteNotes, requestConnector, saveCalendar, saveProfile, snapReceipt, syncNow,
} from "./actions";
import { SheetPicker } from "./sheet-picker";

export type Status = { connected: boolean; account: string | null; lastSync: string | null; error: string | null };
/** Page-level facts some cards need. */
export type Extras = { hasKey: boolean; calendarUrls: string[]; shortcutUrl: string; googleOn: boolean; sheetName: string | null; pickerKey: string; appId: string };

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
  sheet: { label: "Pick it once", icon: Table2 },
  phone: { label: "iPhone Shortcut", icon: Smartphone },
  upload: { label: "Automatic, or snap a photo", icon: Camera },
  paste: { label: "Paste a link", icon: ClipboardPaste },
  guide: { label: "One-time setup", icon: BookOpen },
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

export function ConnectorCard({ c, status, live, x }: { c: Connector; status: Status | null; live: boolean; x: Extras }) {
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
        <Body c={c} on={on} live={live} x={x} />
      </div>
    </div>
  );
}

function Body({ c, on, live, x }: { c: Connector; on: boolean; live: boolean; x: Extras }) {
  switch (c.method) {
    case "oauth":
    case "google":
      return on ? <Connected id={c.id} canSync /> : live ? (
        <a href={`/api/connect/${c.id}`} className={primary}>Connect {c.name}</a>
      ) : null;
    case "sheet":
      return x.googleOn ? (
        x.pickerKey && x.appId ? <SheetPicker sheetName={x.sheetName} pickerKey={x.pickerKey} appId={x.appId} /> : <p className="text-[12px] text-ink-3">The sheet picker is being set up.</p>
      ) : (
        <a href={`/api/connect/${"google"}`} className={quiet}><Plug size={13} /> Connect Google first</a>
      );
    case "phone":
      return <OfficeShortcut id={c.id} on={on} x={x} />;
    case "upload":
      return <SnapReceipt />;
    case "paste":
      return <CalendarForm urls={x.calendarUrls} on={on} />;
    case "guide":
      return c.id === "email-forward" ? <ForwardGuide on={on} /> : <GarminGuide on={on} />;
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

/** One tap: makes a fresh personal key and copies it. Keys are stored hashed, so this is the only time it is visible. */
function KeyCopy({ hasKey }: { hasKey: boolean }) {
  const [state, setState] = useState<"idle" | "confirm" | "copied" | "shown">("idle");
  const [key, setKey] = useState("");
  const [pending, start] = useTransition();
  const make = () =>
    start(async () => {
      const k = (await newKey()).token ?? "";
      setKey(k);
      try {
        await navigator.clipboard.writeText(k);
        setState("copied");
      } catch {
        setState("shown");
      }
    });
  if (state === "copied") return <p className="text-[12.5px] text-good"><Check size={12} className="inline" /> Key copied. Paste it when the Shortcut asks.</p>;
  if (state === "shown") return <Copyable value={key} />;
  if (state === "confirm")
    return (
      <div className="space-y-1">
        <p className="text-[12px] text-ink-2">You already have a key. A new one stops the old one, so any Shortcut using it needs the new key pasted in.</p>
        <div className="flex gap-2">
          <button className={primary} disabled={pending} onClick={make}>{pending ? "Making…" : "Make and copy a new key"}</button>
          <button className={quiet} onClick={() => setState("idle")}>Keep my key</button>
        </div>
      </div>
    );
  return (
    <button className={primary} disabled={pending} onClick={hasKey ? () => setState("confirm") : make}>
      {pending ? "Making…" : hasKey ? "Make and copy a new key" : "Make and copy my Office key"}
    </button>
  );
}


/** iPhone Notes (Gym) and Apple Watch sleep (Bedroom) share one Shortcut, so either card sets up both. */
function OfficeShortcut({ id, on, x }: { id: string; on: boolean; x: Extras }) {
  const [open, setOpen] = useState(false);
  const notes = id === "apple-notes";
  if (!open)
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <button className={on ? quiet : primary} onClick={() => setOpen(true)}>{on ? "Show setup" : "Set up on my iPhone (1 min)"}</button>
          {on && <Connected id={id} />}
        </div>
        {notes && <PasteNote />}
      </div>
    );
  return (
    <div className="space-y-2">
      <p className="text-[12px] text-ink-3">Open this page on your iPhone, then:</p>
      <ol className="list-decimal space-y-2 pl-4 text-[12.5px] leading-relaxed text-ink-2">
        <li><KeyCopy hasKey={x.hasKey} /></li>
        <li>
          {x.shortcutUrl ? (
            <a className={quiet} href={x.shortcutUrl} target="_blank" rel="noreferrer"><Smartphone size={13} /> Add the Office Shortcut</a>
          ) : (
            <span>Add the Office Shortcut (link coming shortly).</span>
          )}
          <div className="mt-1">Tap <b>Add Shortcut</b>. It asks two things: paste your key, then type the name of your workout note (or leave it blank for sleep only).</div>
        </li>
        <li>Run it once and allow Notes and Health when asked. Workouts and last night&apos;s sleep arrive.</li>
        <li>
          Make it daily: Shortcuts, <b>Automation</b>, <b>+</b>, <b>Time of Day</b>, 9 pm, <b>Daily</b>, <b>Run Immediately</b>, choose <b>Office</b>.
        </li>
        <li><button className={on ? quiet : primary} onClick={async () => { await Promise.all([markSetUp("apple-notes"), markSetUp("apple-health")]); setOpen(false); }}>{on ? "Done" : "I've set it up"}</button></li>
      </ol>
      <p className="text-[11.5px] text-ink-3">It sends only that one note and your sleep times, nothing else from your phone.</p>
    </div>
  );
}

function PasteNote() {
  const [state, action, pending] = useActionState(pasteNotes, undefined);
  return (
    <details className="text-[12.5px] text-ink-2">
      <summary className="cursor-pointer text-ink-3">Or paste your note once now</summary>
      <form action={action} className="mt-2 space-y-2">
        <textarea name="text" rows={4} className="field min-h-[90px] text-[12.5px]" placeholder={"Any layout works, e.g.\nMon 10 Nov Push\nBench 60kg 3x8"} />
        <button className={quiet} disabled={pending}>{pending ? "Reading…" : "Read my note"}</button>
      </form>
      {state && <p className={clsx("mt-1 text-[12px]", state.ok ? "text-good" : "text-bad")}>{state.message}</p>}
    </details>
  );
}

/** Shrinks a phone photo to a JPEG of about 1800 px so it fits through a server action. */
async function shrinkPhoto(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85).split(",")[1];
}

function SnapReceipt() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <label className={clsx(primary, "cursor-pointer", pending && "pointer-events-none opacity-60")}>
        <Camera size={13} /> {pending ? "Reading the receipt…" : "Snap a receipt"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setMsg(null);
            let data = "";
            try {
              data = await shrinkPhoto(f);
            } catch {
              return setMsg({ ok: false, text: "Couldn't open that image. Try a JPEG or PNG." });
            }
            start(async () => {
              const r = await snapReceipt(data);
              setMsg({ ok: r.ok, text: r.message });
            });
          }}
        />
      </label>
      {msg && <p className={clsx("text-[12px]", msg.ok ? "text-good" : "text-bad")}>{msg.text}</p>}
      <details className="text-[11.5px] text-ink-3">
        <summary className="cursor-pointer">Make it fully automatic</summary>
        Turn on email receipts in your store&apos;s app (Lidl Plus, Whole Foods, Trader Joe&apos;s, CVS and most loyalty apps offer them) and connect
        Google above. Receipts then reach the Kitchen with no photo. A screenshot of a digital receipt works with the button too.
      </details>
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
        <li>Connect Strava on this page. Garmin runs and workouts then arrive here on their own.</li>
      </ol>
      {on ? <Connected id="garmin" /> : <button className={quiet} onClick={() => markSetUp("garmin")}>Done</button>}
    </div>
  );
}

function ForwardGuide({ on }: { on: boolean }) {
  return (
    <div className="space-y-2 text-[12.5px] text-ink-2">
      <details>
        <summary className="cursor-pointer font-medium">Show the steps for my email</summary>
        <ul className="mt-2 list-disc space-y-1.5 pl-4">
          <li><b>Outlook, school or work (Microsoft):</b> outlook.com or Outlook on the web, Settings, Mail, Forwarding. Turn it on, enter your Gmail, tick Keep a copy.</li>
          <li><b>iCloud Mail:</b> icloud.com/mail, Settings, Forwarding, Forward my email to your Gmail.</li>
          <li><b>Another Gmail:</b> Settings, Forwarding and POP/IMAP, Add a forwarding address. Google sends a code to your connected Gmail; paste it there.</li>
          <li><b>Yahoo:</b> Settings, More settings, Mailboxes, your address, Forwarding.</li>
        </ul>
        <p className="mt-2 text-[11.5px] text-ink-3">Your mail stays in the original inbox too. Some schools and employers block forwarding; then ask IT or skip it.</p>
      </details>
      {on ? <Connected id="email-forward" /> : <button className={quiet} onClick={() => markSetUp("email-forward")}>Done</button>}
    </div>
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
