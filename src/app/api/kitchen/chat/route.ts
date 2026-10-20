import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { fmtQty, itemCost, itemMacros, normalizeQty, perLabel, previewCook, type CookExtra, type CookSplit } from "@/lib/kitchen";
import { receiptEnabled } from "@/lib/receipt";
import type { CookInput } from "@/penthouse/data/actions";

/**
 * Kitchen chat. Emile says what they cooked or ate in plain words; Claude matches it to the fridge and
 * proposes it as a card (ingredients taken, macros eaten, meal prep kept). Nothing is saved here:
 * the card's Save button calls the same server actions as the forms (cookMeal, eatItem, updatePantryItem).
 *
 * The client keeps the API messages and sends them back each turn, append-only. The fridge as it is now
 * goes into each new user message, not the system prompt, so earlier turns never change.
 * Streams NDJSON: {t:"text",d} while Claude writes, {t:"card",card} per proposal, then {t:"done",messages}.
 */

export const dynamic = "force-dynamic";

type Item = {
  id: number;
  name: string;
  place: string;
  qty: number;
  qty_start: number;
  unit: string;
  price: number;
  kcal_per: number;
  protein_per: number;
  carbs_per: number;
  fat_per: number;
  bought: string;
  size_guessed: boolean;
};

type Macros = { kcal: number; protein: number; carbs: number; fat: number };
export type ChatCard =
  | {
      kind: "cook";
      id: string;
      input: CookInput;
      lines: { name: string; amount: string; left: string; short: boolean }[];
      extras: CookExtra[];
      eaten: Macros & { cost: number };
      leftovers: { amount: string; per: Macros; perLabel: string; keepIn: string } | null;
    }
  | { kind: "eat"; id: string; itemId: number; amount: number; name: string; amountLabel: string; eaten: Macros & { cost: number } }
  | { kind: "size"; id: string; itemId: number; name: string; from: string; to: string; size: { qty: number; unit: string }; left: string };

const SYSTEM = `You help Emile log cooking and eating against their fridge, in a personal food tracker.
Each message from Emile ends with the fridge as it is right now: one line per item with its id, amount left, unit and macros.

What you do:
- When Emile says what they cooked, match each ingredient to a fridge item and call propose_cook.
  Convert amounts to the item's unit (2 eggs = 2 item; 1 lb = 454 g; a cup of cooked rice is about 160 g, so use the dry amount if the item is dry rice).
  The split: "made 4 portions, ate 1" is portions; "ate half" with no count is portions made 2, ate 1; "it's all meal prep" is ate 0.
  If Emile weighed the cooked dish, use by weight (cooked grams, eaten grams).
- Ingredients that aren't in the fridge (oil, butter, spices, something never logged): put them in extras with your estimate of their macros
  for the amount used, and say so in one short line. Skip things with no real calories (salt, pepper, water).
- When Emile ate something straight from the fridge (a yogurt, leftovers), call propose_eat.
- When Emile says a package was a different size than the fridge shows ("the beef was 2 lb"), call propose_size_fix.
  Items marked "size guessed" had no size on the receipt; if one comes up, you can mention it once.
- If something is unclear, ask one short question instead of guessing: which item when two could match, how much when no amount was given,
  how much was eaten when it matters. A "some" or "a bit" needs an amount, unless Emile says to estimate.
- Never claim anything is saved. Proposals show up as cards with a Save button; Emile saves them. Messages starting with [Saved] tell you what was saved.

Style: short, plain sentences. No em dashes. Call items by their names; the ids are only for tools, never mention them. Use they/them for Emile. Don't repeat the numbers on the card; one line saying what you proposed is enough.`;

const Split = z.discriminatedUnion("by", [
  z.object({ by: z.literal("portions"), made: z.number().min(0.5).max(50), ate: z.number().min(0).max(50) }),
  z.object({ by: z.literal("weight"), cooked: z.number().positive().max(50_000), ate: z.number().min(0).max(50_000) }),
]);
const Extra = z.object({ name: z.string().min(1).max(100), kcal: z.number().min(0).max(5000), protein: z.number().min(0).max(500), carbs: z.number().min(0).max(500), fat: z.number().min(0).max(500) });
const ProposeCook = z.object({
  name: z.string().min(1).max(200),
  uses: z.array(z.object({ itemId: z.number().int(), amount: z.number().positive() })).min(1).max(30),
  split: Split,
  keepIn: z.enum(["fridge", "freezer"]).default("fridge"),
  extras: z.array(Extra).max(20).default([]),
});
const ProposeEat = z.object({ itemId: z.number().int(), amount: z.number().positive() });
const ProposeSize = z.object({ itemId: z.number().int(), qty: z.number().positive().max(100_000), unit: z.string().min(1).max(10) });

const num = { type: "number" } as const;
const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "propose_cook",
    description: "Show Emile a cook to save: ingredients taken from the fridge, what was eaten now, and what is kept as meal prep. Does not save.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Short dish name, e.g. 'Beef tacos'." },
        uses: {
          type: "array",
          items: {
            type: "object",
            properties: { itemId: { type: "integer" }, amount: { ...num, description: "In the item's unit (g, ml, item or serving)." } },
            required: ["itemId", "amount"],
            additionalProperties: false,
          },
        },
        split: {
          type: "object",
          description: "portions: made and ate in portions. weight: cooked dish grams and grams eaten. ate 0 means it's all meal prep.",
          properties: { by: { type: "string", enum: ["portions", "weight"] }, made: num, cooked: num, ate: num },
          required: ["by", "ate"],
          additionalProperties: false,
        },
        keepIn: { type: "string", enum: ["fridge", "freezer"], description: "Where the meal prep goes. Default fridge." },
        extras: {
          type: "array",
          description: "Ingredients not in the fridge, with macros for the amount used.",
          items: {
            type: "object",
            properties: { name: { type: "string" }, kcal: num, protein: num, carbs: num, fat: num },
            required: ["name", "kcal", "protein", "carbs", "fat"],
            additionalProperties: false,
          },
        },
      },
      required: ["name", "uses", "split"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_eat",
    description: "Show Emile a card to log eating some of one fridge item as is (leftovers, yogurt). Does not save.",
    input_schema: {
      type: "object",
      properties: { itemId: { type: "integer" }, amount: { ...num, description: "In the item's unit." } },
      required: ["itemId", "amount"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_size_fix",
    description: "Show Emile a card to correct a package size (the whole package as bought, not what's left). What's left keeps its share. Does not save.",
    input_schema: {
      type: "object",
      properties: { itemId: { type: "integer" }, qty: num, unit: { type: "string", description: "g, kg, lb, oz, ml, l, fl oz or item." } },
      required: ["itemId", "qty", "unit"],
      additionalProperties: false,
    },
  },
];

const Body = z.object({
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.unknown() })).max(200),
  text: z.string().trim().min(1).max(4000),
});

const r0 = (v: number) => Math.round(v);
const r1 = (v: number) => Math.round(v * 10) / 10;
const macrosLine = (m: Macros) => `${r0(m.kcal)} kcal, P${r1(m.protein)} C${r1(m.carbs)} F${r1(m.fat)}`;

function fridgeText(items: Item[]) {
  if (!items.length) return "The fridge is empty.";
  return items
    .map(
      (i) =>
        `id ${i.id} | ${i.name} | ${i.place} | ${fmtQty(i.qty, i.unit)} left of ${fmtQty(i.qty_start, i.unit)}${i.size_guessed ? " (size guessed)" : ""} | unit ${i.unit} | per ${perLabel(i.unit)}: ${macrosLine({ kcal: i.kcal_per, protein: i.protein_per, carbs: i.carbs_per, fat: i.fat_per })} | bought ${i.bought}`,
    )
    .join("\n");
}

export async function POST(req: Request) {
  if (!receiptEnabled()) return Response.json({ error: "Add ANTHROPIC_API_KEY to use the kitchen chat." }, { status: 400 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid chat" }, { status: 422 });

  const sql = await db();
  const loadFridge = () =>
    sql<Item[]>`select id, name, place, qty, qty_start, unit, price, kcal_per, protein_per, carbs_per, fat_per, bought, size_guessed
                from pantry_items where finished_at is null order by place, name`;
  const fridge = await loadFridge();

  const history = parsed.data.history as Anthropic.Beta.BetaMessageParam[];
  const added: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: [
        { type: "text", text: parsed.data.text },
        { type: "text", text: `Today is ${todayISO()}. The fridge right now:\n${fridgeText(fridge)}` },
      ],
    },
  ];

  const client = new Anthropic();
  const enc = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const send = (o: object) => ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        for (let turn = 0; turn < 6; turn++) {
          const stream = client.beta.messages.stream({
            model: "claude-opus-5-5",
            max_tokens: 16000,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            output_config: { effort: "low" },
            cache_control: { type: "ephemeral" },
            system: SYSTEM,
            tools: TOOLS,
            messages: [...history, ...added],
          });
          stream.on("text", (d) => send({ t: "text", d }));
          const msg = await stream.finalMessage();
          if (msg.stop_reason === "refusal") throw new Error("Claude couldn't help with that one.");
          added.push({ role: "assistant", content: msg.content as Anthropic.Beta.BetaContentBlockParam[] });

          const calls = msg.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
          if (!calls.length) break;
          if (msg.stop_reason === "max_tokens") throw new Error("That reply ran too long. Try again.");

          const items = new Map(fridge.map((i) => [i.id, i]));
          const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
          for (const call of calls) {
            const res = runTool(call, items);
            if (res.card) send({ t: "card", card: res.card });
            results.push({ type: "tool_result", tool_use_id: call.id, content: res.text, ...(res.error ? { is_error: true } : {}) });
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

/** Works out a proposal and its card. Errors go back to Claude so it can fix the call or ask Emile. */
function runTool(call: Anthropic.Beta.BetaToolUseBlock, items: Map<number, Item>): { text: string; card?: ChatCard; error?: boolean } {
  const fail = (text: string) => ({ text, error: true });

  if (call.name === "propose_cook") {
    const p = ProposeCook.safeParse(call.input);
    if (!p.success) return fail(`Invalid input: ${p.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
    const c = p.data;
    const missing = c.uses.filter((u) => !items.has(u.itemId)).map((u) => u.itemId);
    if (missing.length) return fail(`No open fridge item with id ${missing.join(", ")}.`);
    if (c.split.ate > (c.split.by === "portions" ? c.split.made : c.split.cooked)) return fail("Ate more than was made.");
    const split = c.split as CookSplit;
    const pv = previewCook([...items.values()], { uses: c.uses, split, extras: c.extras });
    const lines = pv.uses.map((u) => {
      const it = items.get(u.itemId)!;
      return { name: it.name, amount: fmtQty(u.amount, it.unit), left: fmtQty(u.left, it.unit), short: u.short };
    });
    const per = pv.leftovers?.unit === "serving" ? "portion" : "100 g";
    const card: ChatCard = {
      kind: "cook",
      id: call.id,
      input: { name: c.name, uses: pv.uses.map((u) => ({ itemId: u.itemId, amount: u.amount })), split, keepIn: c.keepIn, extras: c.extras },
      lines,
      extras: c.extras,
      eaten: pv.eaten,
      leftovers: pv.leftovers ? { amount: fmtQty(pv.leftovers.qty, pv.leftovers.unit), per: pv.leftovers.per, perLabel: per, keepIn: c.keepIn } : null,
    };
    const short = lines.filter((l) => l.short).map((l) => l.name);
    return {
      card,
      text: [
        "Shown to Emile as a card with a Save button. Not saved yet.",
        ...lines.map((l) => `${l.name}: uses ${l.amount}, ${l.left} left`),
        short.length ? `Capped at what's left for: ${short.join(", ")}. Tell Emile.` : "",
        `Eaten now: ${macrosLine(pv.eaten)}`,
        pv.leftovers ? `Meal prep: ${card.leftovers!.amount} to the ${c.keepIn}, ${macrosLine(pv.leftovers.per)} per ${per}` : "No meal prep.",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  if (call.name === "propose_eat") {
    const p = ProposeEat.safeParse(call.input);
    if (!p.success) return fail("Invalid input.");
    const it = items.get(p.data.itemId);
    if (!it) return fail(`No open fridge item with id ${p.data.itemId}.`);
    const amount = Math.min(p.data.amount, it.qty);
    const m = itemMacros(it, amount);
    const card: ChatCard = { kind: "eat", id: call.id, itemId: it.id, amount, name: it.name.replace(/, leftovers$/, ""), amountLabel: fmtQty(amount, it.unit), eaten: { ...m, cost: itemCost(it, amount) } };
    return { card, text: `Shown to Emile as a card. Not saved yet. ${it.name}: ${card.amountLabel}, ${macrosLine(m)}${amount < p.data.amount ? ` (only ${fmtQty(it.qty, it.unit)} was left)` : ""}.` };
  }

  if (call.name === "propose_size_fix") {
    const p = ProposeSize.safeParse(call.input);
    if (!p.success) return fail("Invalid input.");
    const it = items.get(p.data.itemId);
    if (!it) return fail(`No open fridge item with id ${p.data.itemId}.`);
    const n = normalizeQty(p.data.qty, p.data.unit);
    const left = (it.qty / it.qty_start) * n.qty;
    const card: ChatCard = { kind: "size", id: call.id, itemId: it.id, name: it.name, from: fmtQty(it.qty_start, it.unit), to: fmtQty(n.qty, n.unit), size: { qty: p.data.qty, unit: p.data.unit }, left: fmtQty(left, n.unit) };
    return { card, text: `Shown to Emile as a card. Not saved yet. ${it.name}: package ${card.from} becomes ${card.to}, ${card.left} left after the fix.` };
  }

  return fail(`Unknown tool ${call.name}.`);
}
