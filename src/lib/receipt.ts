import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { todayISO } from "./dates";

/**
 * Reads a grocery receipt photo, or a line of typed groceries, into items for the pantry.
 * Uses the Claude API (ANTHROPIC_API_KEY). Macros are estimates from typical nutrition labels;
 * the kitchen panel shows them for review before anything is saved.
 */

export const receiptEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

const Item = z.object({
  name: z.string().describe("Short plain name, e.g. 'Chicken thighs, boneless'. No brand codes."),
  qty: z.number().describe("Amount bought, in `unit`. A dozen eggs is qty 12, unit item."),
  unit: z.enum(["g", "ml", "item", "serving"]).describe("Convert lb, oz, kg to g and l, fl oz, gal to ml."),
  price: z.number().describe("Price paid for this line in dollars, after line discounts."),
  place: z.enum(["fridge", "freezer", "pantry"]).describe("Where it is usually stored."),
  kcal_per: z.number().describe("Calories per 100 g/ml when unit is g or ml, otherwise per item or serving."),
  protein_per: z.number().describe("Protein in grams on the same basis as kcal_per."),
  carbs_per: z.number().describe("Carbs in grams on the same basis."),
  fat_per: z.number().describe("Fat in grams on the same basis."),
  use_by: z.string().nullable().describe("YYYY-MM-DD only if printed or obvious, else null."),
});

const Receipt = z.object({
  store: z.string().describe("Store name, or empty string if unknown."),
  date: z.string().nullable().describe("Purchase date YYYY-MM-DD if shown, else null."),
  total: z.number().nullable().describe("Total paid including tax, if shown, else null."),
  items: z.array(Item),
});

export type ReceiptDraft = z.infer<typeof Receipt>;
export type ReceiptInput = { image?: { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" }; text?: string };

const SYSTEM = `You turn grocery receipts and typed shopping notes into pantry items for a personal food tracker in New York.
Only include food and drink. Skip bags, deposits, tax lines, coupons as separate lines, and household items.
When a weight is shown (e.g. 1.32 lb @ 6.99/lb), use it. When it isn't, use the usual package size for that product in a US supermarket.
Expand receipt abbreviations into plain names (e.g. "BNLS SKNLS CHKN THGH" becomes "Chicken thighs, boneless skinless").
Estimate macros from typical US nutrition labels for the raw product as bought.`;

const Estimates = z.object({ items: z.array(Item.extend({ index: z.number().int().describe("Index of the line this is for.") })) });

/** Fills in unit, size, storage and macros for receipt lines that have a name, count and price but nothing else. */
export async function estimateItems(lines: { name: string; qty: number; unit: string; price: number }[]): Promise<ReceiptDraft["items"]> {
  if (!lines.length) return [];
  const client = new Anthropic();
  const res = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(Estimates) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Today is ${todayISO()}. These lines come from a digital receipt. Return one item per line with the same index, keep the price, and turn a count of packages into a weight or volume when the product is sold by package (e.g. 1 x Greek yogurt 32 oz becomes 907 g).\n${lines
          .map((l, i) => `${i}. ${l.name} | ${l.qty} ${l.unit} | $${l.price.toFixed(2)}`)
          .join("\n")}`,
      },
    ],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("Couldn't estimate those items.");
  const byIndex = new Map(res.parsed_output.items.map(({ index, ...it }) => [index, it]));
  return lines.map((l, i) => byIndex.get(i) ?? { name: l.name, qty: l.qty, unit: "item", price: l.price, place: "fridge", kcal_per: 0, protein_per: 0, carbs_per: 0, fat_per: 0, use_by: null });
}

export async function readReceipt(input: ReceiptInput): Promise<ReceiptDraft> {
  if (!receiptEnabled()) throw new Error("Add ANTHROPIC_API_KEY to read receipts.");
  if (!input.image && !input.text?.trim()) throw new Error("Nothing to read.");

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (input.image) content.push({ type: "image", source: { type: "base64", media_type: input.image.mediaType, data: input.image.data } });
  content.push({
    type: "text",
    text: input.image
      ? `Read this grocery receipt. Today is ${todayISO()}.${input.text ? `\nNote from me: ${input.text}` : ""}`
      : `Today is ${todayISO()}. Here is what I bought:\n${input.text}`,
  });

  const client = new Anthropic();
  const res = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(Receipt) },
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });
  if (res.stop_reason === "refusal") throw new Error("Claude couldn't read that one. Try typing the items instead.");
  if (!res.parsed_output) throw new Error("Couldn't read the receipt. Try a sharper photo or type the items.");
  return res.parsed_output;
}
