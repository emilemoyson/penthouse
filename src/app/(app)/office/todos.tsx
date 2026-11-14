"use client";

import { useOptimistic, useState, useTransition } from "react";
import clsx from "clsx";
import { ArrowUpRight, Check, Plus } from "lucide-react";
import type { Todo } from "@/penthouse/data/types";
import { addDays, fDay, fDow, fMonth, mondayOf } from "@/lib/dates";
import { btn } from "@/components/ui";
import { addTodo, setTodoDone } from "./actions";

/** Where a to-do came from, read from its link or id. */
function sourceOf(t: Todo): { label: string; cls: string } {
  const u = t.url ?? "";
  if (t.id.startsWith("manual-")) return { label: "Added by you", cls: "bg-surface-2 text-ink-2" };
  if (/whatsapp|wa\.me/i.test(u) || t.id.startsWith("wa-")) return { label: "WhatsApp", cls: "bg-good-soft text-good" };
  if (/blackboard/i.test(u) || /blackboard/i.test(t.sender)) return { label: "Blackboard", cls: "bg-warn-soft text-warn" };
  if (t.id.startsWith("outlook:") || /outlook|office\.com|live\.com/i.test(u)) return { label: "Outlook", cls: "bg-accent-soft text-accent-ink" };
  if (/mail\.google/i.test(u) || u) return { label: "Gmail", cls: "bg-bad-soft text-bad" };
  return { label: "Email", cls: "bg-surface-2 text-ink-2" };
}

const dueLabel = (d: string, today: string) =>
  d === today ? "Today" : d === addDays(today, 1) ? "Tomorrow" : `${fDow(d)} ${fMonth(d)} ${fDay(d)}`;

export function TodoBoard({ items, today }: { items: Todo[]; today: string }) {
  const [pending, start] = useTransition();
  const [list, flip] = useOptimistic(items, (cur, id: string) => cur.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const weekEnd = addDays(mondayOf(today), 6);
  const groups = [
    { id: "overdue", title: "Overdue", tone: "text-bad", test: (t: Todo) => !!t.due && t.due < today },
    { id: "today", title: "Today", tone: "text-accent-ink", test: (t: Todo) => t.due === today },
    { id: "week", title: "This week", tone: "text-ink", test: (t: Todo) => !!t.due && t.due > today && t.due <= weekEnd },
    { id: "later", title: "Later", tone: "text-ink", test: (t: Todo) => !!t.due && t.due > weekEnd },
    { id: "none", title: "No date", tone: "text-ink", test: (t: Todo) => !t.due },
  ];
  const open = list.filter((t) => !t.done);
  const done = list.filter((t) => t.done);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setErr(null);
    start(async () => {
      try {
        await addTodo({ title, due: due || null });
        setTitle("");
        setDue("");
      } catch {
        setErr("Couldn't save that one. Try again.");
      }
    });
  }

  function toggle(t: Todo) {
    start(async () => {
      flip(t.id);
      await setTodoDone(t.id, !t.done);
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-4">
        <form onSubmit={submit} className="flex flex-wrap gap-2 rounded-2xl border border-line bg-surface p-2 shadow-[var(--shadow)]">
          <input className="field min-w-[220px] flex-1 border-transparent" placeholder="Add a to-do" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          <input type="date" className="field w-[150px]" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
          <button className={btn.primary} disabled={pending || !title.trim()}>
            <Plus size={15} /> Add
          </button>
          {err && <div className="w-full px-2 text-[12.5px] text-bad">{err}</div>}
        </form>

        {open.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-[14px] text-ink-3">
            Nothing open. The hourly email task adds to-dos here when it finds them.
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          {groups.map((g) => {
            const rows = open.filter(g.test);
            if (!rows.length) return null;
            return (
              <section key={g.id} className="min-w-0 rounded-2xl border border-line bg-surface shadow-[var(--shadow)]">
                <h2 className={clsx("flex items-center gap-2 px-4 pb-1 pt-3.5 font-serif text-[16px] font-medium", g.tone)}>
                  {g.title}
                  <span className="font-sans text-[12px] text-ink-3 tnum">{rows.length}</span>
                </h2>
                <ul className="divide-y divide-line">
                  {rows.map((t) => (
                    <Row key={t.id} t={t} today={today} onToggle={() => toggle(t)} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      <aside className="min-w-0 space-y-4">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { n: open.filter((t) => t.due && t.due < today).length, l: "overdue", c: "text-bad" },
              { n: open.filter((t) => t.due === today).length, l: "today", c: "text-accent-ink" },
              { n: open.length, l: "open", c: "" },
            ].map((s) => (
              <div key={s.l}>
                <div className={clsx("font-serif text-[26px] font-medium tnum", s.c)}>{s.n}</div>
                <div className="text-[12px] text-ink-3">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        {done.length > 0 && (
          <div className="rounded-2xl border border-line bg-surface shadow-[var(--shadow)]">
            <h2 className="px-4 pb-1 pt-3.5 text-[13px] font-medium text-ink-3">Done in the last day</h2>
            <ul className="divide-y divide-line">
              {done.map((t) => (
                <Row key={t.id} t={t} today={today} onToggle={() => toggle(t)} compact />
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}

function Row({ t, today, onToggle, compact }: { t: Todo; today: string; onToggle: () => void; compact?: boolean }) {
  const src = sourceOf(t);
  return (
    <li className="group flex items-start gap-3 px-4 py-2.5">
      <button
        onClick={onToggle}
        className={clsx(
          "mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition",
          t.done ? "border-good bg-good text-white" : "border-line-strong hover:border-accent",
        )}
        aria-label={t.done ? "Mark as not done" : "Mark as done"}
      >
        {t.done && <Check size={12} strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <div className={clsx("text-[14px] leading-snug", t.done && "text-ink-3 line-through")}>{t.title}</div>
        {!compact && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3">
            <span className={clsx("rounded-full px-1.5 py-px text-[11px] font-medium", src.cls)}>{src.label}</span>
            {t.sender && t.sender !== "You" && <span className="truncate">{t.sender}</span>}
            {t.due && <span className={clsx("tnum", t.due < today && "text-bad")}>· {dueLabel(t.due, today)}</span>}
          </div>
        )}
        {!compact && t.detail && <div className="mt-1 line-clamp-2 text-[12.5px] text-ink-2">{t.detail}</div>}
      </div>
      {t.url && (
        <a
          href={t.url}
          target="_blank"
          rel="noreferrer"
          className="flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-1 text-[12px] text-ink-3 hover:bg-surface-2 hover:text-accent-ink"
        >
          Open email <ArrowUpRight size={12} />
        </a>
      )}
    </li>
  );
}
