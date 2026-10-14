"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

export function DeleteButton({ action, id, label }: { action: (id: number) => Promise<void>; id: number; label: string }) {
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();
  if (armed) {
    return (
      <span className="flex shrink-0 items-center gap-1">
        <button
          onClick={() => start(() => action(id))}
          disabled={pending}
          className="h-8 rounded-lg bg-bad px-2.5 text-[12.5px] font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Deleting…" : "Delete"}
        </button>
        <button onClick={() => setArmed(false)} className="h-8 rounded-lg px-2 text-[12.5px] text-ink-3 hover:bg-surface-2">
          Cancel
        </button>
      </span>
    );
  }
  return (
    <button
      onClick={() => setArmed(true)}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:bg-bad-soft hover:text-bad"
      aria-label={`Delete ${label}`}
    >
      <Trash2 size={14} />
    </button>
  );
}
