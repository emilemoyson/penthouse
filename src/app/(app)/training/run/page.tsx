import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { durStr, type Run } from "@/lib/training";
import { PageHeader } from "@/components/ui";
import { RunForm } from "./run-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Log run" };

export default async function RunPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  let initial: (Omit<Run, "duration_sec"> & { duration: string }) | null = null;
  if (id) {
    const sql = await db();
    const rows = await sql<Run[]>`select * from runs where id = ${Number(id)}`;
    if (!rows.length) notFound();
    const r = rows[0];
    initial = { ...r, duration: durStr(r.duration_sec) };
  }
  return (
    <div className="mx-auto max-w-[560px]">
      <PageHeader title={initial ? "Edit run" : "Log run"} sub="Distance and time are enough. Pace is worked out for you." />
      <RunForm today={todayISO()} initial={initial} />
    </div>
  );
}
