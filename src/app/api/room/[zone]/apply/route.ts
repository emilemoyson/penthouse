import { z } from "zod";
import { apply } from "@/lib/room-actions";

/** Saves a card a room agent proposed, after Emile presses Save. Behind the session cookie like every /api route but ingest. */
export const dynamic = "force-dynamic";

const Zone = z.enum(["bed", "desk", "gym", "kitchen"]);
const Body = z.object({ tool: z.string().min(1).max(40), input: z.unknown() });

export async function POST(req: Request, ctx: { params: Promise<{ zone: string }> }) {
  const zone = Zone.safeParse((await ctx.params).zone);
  if (!zone.success) return Response.json({ error: "unknown room" }, { status: 404 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "invalid request" }, { status: 422 });
  try {
    const summary = await apply(zone.data, body.data.tool, body.data.input);
    return Response.json({ ok: true, summary });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Couldn't save that." }, { status: 400 });
  }
}
