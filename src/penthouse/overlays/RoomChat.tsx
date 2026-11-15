"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { ArrowUp, Check } from "lucide-react";
import type { ZoneId } from "../store";
import type { ActionCard } from "@/lib/room-actions";

type Card = ActionCard & { state: "open" | "saving" | "saved" | "dismissed"; error?: string };
type Turn = { role: "user" | "assistant"; text: string; error?: string; cards?: Card[] };
type ApiMessage = { role: "user" | "assistant"; content: unknown };

const STARTERS: Record<ZoneId, string[]> = {
  bed: ["How rested am I?", "I slept 11:30 to 7:15 last night"],
  desk: ["What should I do first today?", "Remind me to email Dario on Monday"],
  gym: ["What should I train next?", "Log today: bench 185x5x3, rows 135x8x3"],
  kitchen: ["How much protein do I still need?", "Had a Chipotle chicken bowl for lunch"],
};

const AGENT: Record<ZoneId, string> = { bed: "Ask the bedroom", desk: "Ask the office", gym: "Ask your coach", kitchen: "Ask the kitchen" };

/**
 * Chat with a room's agent (/api/room/:zone/chat). Each room keeps its own conversation while the page is open.
 * The agent can propose changes; they show up as cards and are only written when Emile presses Save.
 */
export function RoomChat({ zone, color }: { zone: ZoneId; color: string }) {
  const [turns, setTurns] = useState<Turn[]>(() => chats.get(zone)?.turns ?? []);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const router = useRouter();

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
        body: JSON.stringify({ history: chats.get(room)?.history ?? [], text: [...notes(room).splice(0), said].join("\n") }),
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
          const ev = JSON.parse(line) as { t: "text"; d: string } | { t: "card"; card: ActionCard } | { t: "done"; messages: ApiMessage[] } | { t: "error"; message: string };
          if (ev.t === "text") patch((l) => ({ text: l.text + ev.d }));
          else if (ev.t === "card") patch((l) => ({ cards: [...(l.cards ?? []), { ...ev.card, state: "open" }] }));
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

  const setCard = (id: string, p: Partial<Card>) =>
    update((ts) => ts.map((t) => (t.cards?.some((c) => c.id === id) ? { ...t, cards: t.cards.map((c) => (c.id === id ? { ...c, ...p } : c)) } : t)));

  const save = async (c: Card) => {
    const room = zone;
    setCard(c.id, { state: "saving", error: undefined });
    try {
      const res = await fetch(`/api/room/${room}/apply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tool: c.tool, input: c.input }) });
      const out = (await res.json().catch(() => null)) as { summary?: string; error?: string } | null;
      if (!res.ok) throw new Error(out?.error ?? "Couldn't save that.");
      setCard(c.id, { state: "saved" });
      notes(room).push(`[Saved] ${out?.summary ?? c.title}`);
      router.refresh();
    } catch (e) {
      setCard(c.id, { state: "open", error: e instanceof Error ? e.message : "Couldn't save that." });
    }
  };
  const dismiss = (c: Card) => {
    setCard(c.id, { state: "dismissed" });
    notes(zone).push(`[Dismissed] ${c.title}`);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={list} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]">
        {turns.length === 0 && (
          <div className="flex h-full flex-col justify-end gap-2 pb-1">
            <p className="text-[12.5px] text-white/45">This room&rsquo;s agent knows its data. Ask it things, or tell it what to log or change: it shows you a card first, and nothing is saved until you press Save.</p>
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
              {t.cards?.map((c) => <CardView key={c.id} c={c} color={color} onSave={() => save(c)} onDismiss={() => dismiss(c)} />)}
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
// what Emile saved or dismissed since the last message; rides along with the next one so the agent knows
const pending = new Map<ZoneId, string[]>();
const notes = (z: ZoneId) => pending.get(z) ?? (pending.set(z, []), pending.get(z)!);

function CardView({ c, color, onSave, onDismiss }: { c: Card; color: string; onSave: () => void; onDismiss: () => void }) {
  const done = c.state === "saved" || c.state === "dismissed";
  return (
    <div className={clsx("mt-2.5 rounded-xl border bg-white/[0.04] px-3 py-2.5", done ? "border-white/8 opacity-70" : "border-white/15")}>
      <div className="text-[13px] font-medium text-white">{c.title}</div>
      <div className="mt-0.5 space-y-0.5 text-[12.5px] leading-snug text-white/60">
        {c.lines.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
      {c.error && <div className="mt-1.5 text-[12px] text-rose-300">{c.error}</div>}
      <div className="mt-2 flex items-center gap-2">
        {c.state === "saved" ? (
          <span className="inline-flex items-center gap-1 text-[12px] text-emerald-300">
            <Check size={13} /> Saved
          </span>
        ) : c.state === "dismissed" ? (
          <span className="text-[12px] text-white/40">Not saved</span>
        ) : (
          <>
            <button
              onClick={onSave}
              disabled={c.state === "saving"}
              className="rounded-lg px-3 py-1 text-[12.5px] font-medium text-black transition disabled:opacity-60"
              style={{ background: color }}
            >
              {c.state === "saving" ? "Saving" : "Save"}
            </button>
            <button onClick={onDismiss} disabled={c.state === "saving"} className="rounded-lg px-2 py-1 text-[12.5px] text-white/55 transition hover:text-white">
              Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Dots({ color }: { color: string }) {
  return (
    <span className="inline-flex gap-1 py-1.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 animate-pulse rounded-full" style={{ background: color, animationDelay: `${i * 160}ms` }} />
      ))}
    </span>
  );
}
