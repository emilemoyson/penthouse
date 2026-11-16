"use client";

import { useEffect, useState, useTransition } from "react";
import clsx from "clsx";
import { Check, Plug } from "lucide-react";
import type { Connector } from "@/lib/connectors/catalog";
import type { CalendarChoice } from "@/lib/connectors/google";
import { googleCalendars, saveGoogleCalendars } from "./actions";
import { Connected, type Status } from "./ui";

const btn = "inline-flex h-8 items-center justify-center gap-1.5 rounded-[9px] px-3 text-[13px] font-medium transition disabled:opacity-60";
const primary = clsx(btn, "bg-ink text-bg hover:opacity-90");

const ago = (iso: string | null) => {
  if (!iso) return "not yet";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
};

export function GoogleCard({ c, status }: { c: Connector; status: Status | null }) {
  const on = !!status?.connected;
  return (
    <section className={clsx("rounded-2xl border bg-surface p-5", on ? "border-good/40" : "border-line")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-[640px]">
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-[21px] font-medium">Connect Google</h2>
            {on && (
              <span className="inline-flex items-center gap-1 rounded-full bg-good-soft px-2 py-0.5 text-[11.5px] font-medium text-good">
                <Check size={12} /> Connected
              </span>
            )}
          </div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{c.blurb}</p>
          {on && (
            <p className={clsx("mt-1 text-[12px]", status?.error ? "text-bad" : "text-ink-3")}>
              {status?.error ? `Last sync: ${status.error}` : `${status?.account ? `${status.account}. ` : ""}Email checked ${ago(status?.lastSync ?? null)}.`}
            </p>
          )}
        </div>
        {on ? <Connected id="google" canSync /> : (
          <a href={`/api/connect/${c.id}`} className={primary}><Plug size={13} /> Connect Google</a>
        )}
      </div>

      {on ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Calendars />
          <div className="space-y-1.5">
            <h3 className="text-[13px] font-semibold">Email</h3>
            <p className="text-[12.5px] leading-relaxed text-ink-2">
              Every hour Claude reads new mail (not promotions or social). To-dos go to your Office, confirmed plans go on your Google
              Calendar marked &quot;Added by The Office&quot;, and grocery order emails fill the Kitchen. Email text is never stored.
            </p>
            {!status?.lastSync && <p className="text-[12px] text-ink-3">Reading your recent email now. To-dos appear in about a minute.</p>}
          </div>
        </div>
      ) : (
        <ul className="mt-3 grid gap-1 text-[12.5px] text-ink-2 md:grid-cols-3">
          <li><b>Office:</b> every calendar you already use, plus to-dos found in your email.</li>
          <li><b>Kitchen:</b> online grocery orders (Instacart, Amazon Fresh, Walmart) fill the fridge.</li>
          <li><b>Gym:</b> pick the Google Sheet you log workouts in (in the Gym below). Only that one file is shared.</li>
        </ul>
      )}
      {!on && (
        <p className="mt-3 text-[11.5px] text-ink-3">
          Google shows an &quot;unverified app&quot; notice while The Office is in review. Click Advanced, then Continue. You can disconnect any time.
        </p>
      )}
    </section>
  );
}

function Calendars() {
  const [items, setItems] = useState<CalendarChoice[] | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => {
    googleCalendars().then((r) => (r.ok ? setItems(r.items) : setErr(r.message)));
  }, []);
  const toggle = (id: string) => {
    if (!items) return;
    const next = items.map((c) => (c.id === id ? { ...c, on: !c.on } : c));
    setItems(next);
    start(async () => setMsg((await saveGoogleCalendars(next.filter((c) => c.on).map((c) => c.id))).message));
  };
  return (
    <div className="space-y-1.5">
      <h3 className="text-[13px] font-semibold">Calendars shown in the Office</h3>
      {err && <p className="text-[12px] text-bad">{err}</p>}
      {!items && !err && <p className="text-[12px] text-ink-3">Loading your calendars…</p>}
      {items && (
        <ul className="max-h-48 space-y-1 overflow-auto pr-1">
          {items.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-2">
                <input type="checkbox" checked={c.on} disabled={pending} onChange={() => toggle(c.id)} />
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                <span className="truncate">{c.name}{c.primary ? " (main)" : ""}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className="text-[12px] text-ink-3">{msg}</p>}
    </div>
  );
}
