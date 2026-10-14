"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {}
      }}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-ink-2 ring-1 ring-inset ring-line hover:bg-surface-2 hover:text-ink"
    >
      {done ? <Check size={13} className="text-good" /> : <Copy size={13} />}
      {done ? "Copied" : "Copy message"}
    </button>
  );
}
