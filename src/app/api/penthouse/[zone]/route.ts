import { NextResponse } from "next/server";
import { getZoneData } from "@/penthouse/data/server";

export const dynamic = "force-dynamic";

const ZONES = ["sleep", "professional", "fitness", "nutrition"] as const;

/** GET /api/penthouse/:zone → the panel payload (session cookie required, see middleware). */
export async function GET(_req: Request, { params }: { params: Promise<{ zone: string }> }) {
  const { zone } = await params;
  if (!(ZONES as readonly string[]).includes(zone)) return NextResponse.json({ error: "unknown zone" }, { status: 404 });
  try {
    const data = await getZoneData(zone as (typeof ZONES)[number]);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
