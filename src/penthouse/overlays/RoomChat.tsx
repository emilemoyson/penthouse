"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowUp } from "lucide-react";
import type { ZoneId } from "../store";

type Turn = { role: "user" | "assistant"; text: string; error?: string };
type ApiMessage = { role: "user" | "assistant"; content: unknown };

const STARTERS: Record<ZoneId, string[]> = {
  bed: ["How rested am I?", "When should I go to bed tonight?"],
  desk: ["What should I do first today?", "What's coming up this week?"],
  gym: ["What should I train next?", "Which muscles am I skipping?"],
  kitchen: ["What can I cook with what I have?", "How much protein do I still need?"],
};

const AGENT: Record<ZoneId, string> = { bed: "Ask the bedroom", desk: "Ask the office", gym: "Ask your coach", kitchen: "Ask the kitchen" };

/**
 * Chat with a room's agent (/api/room/:zone/chat). Each room keeps its own conversation while the page is open.
 * Read-only: the agent answers from that room's data and never saves anything.
 */
export function RoomChat({ zone, color }: { zone: ZoneId; color: string }) {
  const [turns, setTurns] = useState<Turn[]>(() => chats.get(zone)?.turns ?? []);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLDivElement>(null);

  // switching rooms swaps to that room's conversation
  useEffect(() => {
    setTurns(chats.get(zone)?.turns ?? []);
  }, [zone]);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [turns]);

  const update = (fn: (ts: Turn[]) => Turn[]) =>
    setTurns((ts) => {
      const next = fn(ts);
      chats.set(zone, { turns: next, history: chats.get(zone)?.history ?? [] });
      return next;
    });

  const send = async (said: string) => {
    said = said.trim();
    if (!said || busy) return;
    const room = zone;
    setText("");
    setBusy(true);
    update((ts) => [...ts, { role: "user", text: said }, { role: "assistant", text: "" }]);
    const patch = (fn: (t: Turn) => Partial<Turn>) => update((ts) => (ts.length ? [...ts.slice(0, -1), { ...ts[ts.length - 1], ...fn(ts[ts.length - 1]) }] : ts));
    try {
      const res = await fetch(`/api/room/${room}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: chats.get(room)?.history ?? [], text: said }),
      });
      if (!res.ok || !res.body) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Couldn't reach this room.");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as { t: "text"; d: string } | { t: "done"; messages: ApiMessage[] } | { t: "error"; message: string };
          if (ev.t === "text") patch((l) => ({ text: l.text + ev.d }));
          else if (ev.t === "error") patch(() => ({ error: ev.message }));
          else {
            // only a finished turn joins the conversation, so a failed one can just be asked again
            const c = chats.get(room);
            if (c) c.history = [...c.history, ...ev.messages];
          }
        }
      }
    } catch (e) {
      patch(() => ({ error: e instanceof Error ? e.message : "Something went wrong." }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={list} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]">
        {turns.length === 0 && (
          <div className="flex h-full flex-col justify-end gap-2 pb-1">
            <p className="text-[12.5px] text-white/45">This room&rsquo;s agent knows its data and can help you think it through. It reads, it doesn&rsquo;t save.</p>
            <div className="flex flex-wrap gap-1.5">
              {STARTERS[zone].map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-[12.5px] text-white/80 transition hover:bg-white/[0.12] hover:text-white"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="ml-10 rounded-2xl rounded-br-sm bg-white/[0.1] px-3 py-2 text-[13.5px] leading-snug">
              {t.text}
            </div>
          ) : (
            <div key={i} className="mr-6 text-[13.5px] leading-relaxed text-white/85">
              {t.text ? <span className="whitespace-pre-wrap">{t.text}</span> : !t.error && <Dots color={color} />}
              {t.error && <div className="mt-1 text-[12.5px] text-rose-300">{t.error}</div>}
            </div>
          ),
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="mt-3 flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.06] py-1 pl-3.5 pr-1 focus-within:border-white/30"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={AGENT[zone]}
          maxLength={2000}
          className="h-9 min-w-0 flex-1 bg-transparent text-[13.5px] text-white outline-none placeholder:text-white/35"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          aria-label="Send"
          className={clsx("grid size-8 place-items-center rounded-xl transition", busy || !text.trim() ? "bg-white/[0.06] text-white/30" : "text-black")}
          style={busy || !text.trim() ? undefined : { background: color }}
        >
          <ArrowUp size={16} />
        </button>
      </form>
    </div>
  );
}

// conversations live for as long as the page is open, one per room
const chats = new Map<ZoneId, { turns: Turn[]; history: ApiMessage[] }>();

function Dots({ color }: { color: string }) {
  return (
    <span className="inline-flex gap-1 py-1.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 animate-pulse rounded-full" style={{ background: color, animationDelay: `${i * 160}ms` }} />
      ))}
    </span>
  );
}
