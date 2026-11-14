"use client";

import { useOptimistic, useState, useTransition } from "react";
import clsx from "clsx";
import { ArrowUpRight, Check, Plus } from "lucide-react";
import type { Todo } from "@/penthouse/data/types";
import { addDays, fDay, fMonth } from "@/lib/dates";
import { addTodo, setTodoDone } from "../office/actions";

const dueLabel = (d: string, today: string) =>
  d < today ? "Overdue" : d === today ? "Today" : d === addDays(today, 1) ? "Tomorrow" : `${fMonth(d)} ${fDay(d)}`;

const fromLabel = (t: Todo) =>
  t.id.startsWith("manual-") ? "You" : t.id.startsWith("outlook:") ? "Outlook" : t.id.startsWith("blackboard:") ? "Blackboard" : "Gmail";

/** Compact to-do list for the one-page view: dated first, then undated; tick to finish, one line to add. */
export function DashTodos({ items, today }: { items: Todo[]; today: string }) {
  const [, start] = useTransition();
  const [list, flip] = useOptimistic(items, (cur, id: string) => cur.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const [title, setTitle] = useState("");
  const [err, setErr] = useState(false);

  const open = list
    .filter((t) => !t.done)
    .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
  const done = list.filter((t) => t.done);

  function toggle(t: Todo) {
    start(async () => {
      flip(t.id);
      await setTodoDone(t.id, !t.done);
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setErr(false);
    start(async () => {
      try {
        await addTodo({ title, due: null });
        setTitle("");
      } catch {
        setErr(true);
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="scroll-soft min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1">
        {open.length === 0 && <li className="py-2 text-[13px] text-ink-3">Nothing open. New ones arrive from your email every hour.</li>}
        {[...open, ...done].map((t) => (
          <li key={t.id} className="group flex items-start gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-surface-2">
            <button
              onClick={() => toggle(t)}
              aria-label={t.done ? `Mark "${t.title}" as not done` : `Mark "${t.title}" as done`}
              className={clsx(
                "mt-[1px] flex size-[17px] shrink-0 items-center justify-center rounded-[5px] border transition",
                t.done ? "border-transparent bg-good text-bg" : "border-line-strong hover:border-accent",
              )}
            >
              {t.done && <Check size={12} strokeWidth={3} />}
            </button>
            <div className="min-w-0 flex-1">
              <div className={clsx("truncate text-[13px] leading-snug", t.done && "text-ink-3 line-through")} title={t.detail || t.title}>
                {t.title}
              </div>
              <div className="truncate text-[11.5px] text-ink-3">
                {t.sender || fromLabel(t)}
                {t.sender && ` · ${fromLabel(t)}`}
              </div>
            </div>
            {t.due && !t.done && (
              <span className={clsx("shrink-0 text-[11.5px] tnum", t.due < today ? "text-bad" : t.due === today ? "text-accent-ink" : "text-ink-3")}>
                {dueLabel(t.due, today)}
              </span>
            )}
            {t.url && (
              <a href={t.url} target="_blank" rel="noreferrer" className="shrink-0 text-ink-3 opacity-0 transition hover:text-ink group-hover:opacity-100" aria-label="Open the email">
                <ArrowUpRight size={14} />
              </a>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="mt-2 flex items-center gap-2 rounded-lg border border-line bg-surface-2/50 px-2.5 focus-within:border-accent">
        <Plus size={14} className="text-ink-3" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={err ? "Couldn't save that one. Try again." : "Add a to-do"}
          maxLength={200}
          className="h-9 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-3"
        />
      </form>
    </div>
  );
}
