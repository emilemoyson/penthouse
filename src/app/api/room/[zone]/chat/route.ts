import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getPenthouseData } from "@/penthouse/data/server";
import { receiptEnabled } from "@/lib/receipt";
import type { PenthouseData } from "@/penthouse/data/types";
import { check, editContext, toolsFor, type ActionCard } from "@/lib/room-actions";

/**
 * Room agents for the studio. Each room is a small agent that answers from that room's data only:
 * bedroom → sleep, office → calendar and to-dos, gym → training, kitchen → food and pantry.
 * Each room can also propose changes (log a meal, edit a session, tick a to-do, log a night). A proposal
 * streams to the browser as a card; nothing is written until Emile presses Save (/api/room/:zone/apply).
 *
 * Same wire format as the kitchen chat: the client sends the API history back each turn (append-only),
 * fresh room data rides in the new user message, and the reply streams as NDJSON
 * {t:"text",d}, {t:"card",card} per proposal, then {t:"done",messages} or {t:"error",message}.
 */

export const dynamic = "force-dynamic";

const Zone = z.enum(["bed", "desk", "gym", "kitchen"]);
type Zone = z.infer<typeof Zone>;

const Body = z.object({
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.unknown() })).max(40),
  text: z.string().trim().min(1).max(2000),
});

const ROLE: Record<Zone, { name: string; job: string; key: keyof Omit<PenthouseData, "today"> }> = {
  bed: {
    name: "the bedroom",
    key: "sleep",
    job: "You look after Emile's sleep and recovery. You know last night, the last two weeks of nights and their sleep goal. Help them read how rested they are and plan tonight (a sensible bedtime, winding down).",
  },
  desk: {
    name: "the office",
    key: "professional",
    job: "You look after Emile's work and school week. You know their calendar for the coming weeks and their to-do list (read from Gmail, Outlook and Blackboard, plus ones they added). Help them see what matters today, plan around meetings and pick what to do next.",
  },
  gym: {
    name: "the gym",
    key: "fitness",
    job: "You are Emile's training coach. You know this week's sessions and runs, last week, the streak, which muscles got how many sets, and how their top lifts are moving. Help them decide what to train next and spot gaps.",
  },
  kitchen: {
    name: "the kitchen",
    key: "nutrition",
    job: "You look after Emile's food. You know today's meals and macros against their targets, the last week of calories and protein, what is in the fridge and pantry (and what to use soon), and food spending. Help them decide what to eat next with what they have.",
  },
};

const system = (z: Zone) => `You are the agent for ${ROLE[z].name} in Emile's Hub, a personal dashboard drawn as a 3D apartment.
${ROLE[z].job}

Each message from Emile ends with this room's data as it is right now, as JSON. Rules:
- Answer only from that data and what Emile tells you. If something isn't in it, say so plainly. Never invent numbers.
- If the data is marked "sample", it is example data because nothing is connected yet. Say that once when it matters.
- When Emile wants something logged, changed or removed, use your tools. A tool call shows Emile a card with a Save button;
  it is not saved until they press it, so never say it's saved or logged. Call the tool first, with no text before it.
  After it, one or two short lines: what you estimated, if anything, and any useful note. Don't repeat the card's numbers.
  Messages starting with [Saved] tell you what Emile saved.
- Work out dates yourself from today's date ("last night", "yesterday", "Tuesday"). Fill in sensible estimates (macros for a known dish,
  a typical time for "dinner") rather than asking, and say in a few words what you estimated. Ask one short question only when a guess
  could easily be wrong in a way that matters (which session to change, how much of something).
- Use ids from the data only in tool calls; never mention them.
- If a question belongs to another room (sleep, office, gym, kitchen), answer briefly if the data allows, or suggest asking that room.

Style: short, plain sentences, two to five of them unless Emile asks for more. No em dashes. No markdown headings. Use they/them for Emile.`;

export async function POST(req: Request, ctx: { params: Promise<{ zone: string }> }) {
  const zone = Zone.safeParse((await ctx.params).zone);
  if (!zone.success) return Response.json({ error: "unknown room" }, { status: 404 });
  if (!receiptEnabled()) return Response.json({ error: "Add ANTHROPIC_API_KEY to talk to the rooms." }, { status: 400 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid chat" }, { status: 422 });

  const data = await getPenthouseData();
  const slice = data[ROLE[zone.data].key];
  const extra = await editContext(zone.data, data.today).catch(() => "");

  const history = parsed.data.history as Anthropic.Beta.BetaMessageParam[];
  const added: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: [
        { type: "text", text: parsed.data.text },
        { type: "text", text: `Today is ${data.today}. ${ROLE[zone.data].name[4].toUpperCase()}${ROLE[zone.data].name.slice(5)} data right now:\n${JSON.stringify(slice)}${extra ? `\n\n${extra}` : ""}` },
      ],
    },
  ];

  const tools = toolsFor(zone.data);
  const client = new Anthropic();
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const send = (o: object) => ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        for (let turn = 0; turn < 5; turn++) {
          const stream = client.beta.messages.stream({
            model: "claude-opus-5-5",
            max_tokens: 8000,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            output_config: { effort: "low" },
            thinking: { type: "adaptive", display: "omitted" }, // estimates get worked out here, not in the reply
            cache_control: { type: "ephemeral" },
            system: system(zone.data),
            tools,
            messages: [...history, ...added],
          });
          stream.on("text", (d) => send({ t: "text", d }));
          const msg = await stream.finalMessage();
          if (msg.stop_reason === "refusal") throw new Error("The room couldn't help with that one.");
          added.push({ role: "assistant", content: msg.content as Anthropic.Beta.BetaContentBlockParam[] });

          const calls = msg.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
          if (!calls.length) break;
          if (msg.stop_reason === "max_tokens") throw new Error("That reply ran too long. Try again.");
          const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
          for (const call of calls) {
            try {
              const c = await check(zone.data, call.name, call.input);
              const card: ActionCard = { id: call.id, tool: call.name as ActionCard["tool"], input: c.input, title: c.title, lines: c.lines };
              send({ t: "card", card });
              results.push({ type: "tool_result", tool_use_id: call.id, content: "Shown to Emile as a card. Not saved until they press Save." });
            } catch (e) {
              results.push({ type: "tool_result", tool_use_id: call.id, content: e instanceof Error ? e.message : "Failed.", is_error: true });
            }
          }
          added.push({ role: "user", content: results });
          send({ t: "text", d: "\n\n" });
        }
        send({ t: "done", messages: added });
      } catch (e) {
        const message = e instanceof Anthropic.APIError ? `Claude is unavailable right now (${e.status ?? "network"}).` : e instanceof Error ? e.message : "Something went wrong.";
        send({ t: "error", message });
      } finally {
        ctrl.close();
      }
    },
  });

  return new Response(body, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
