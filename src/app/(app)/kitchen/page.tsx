import { db } from "@/lib/db";
import { fLong, fShort, lastNDays, lastNWeeks, todayISO } from "@/lib/dates";
import { itemCost, money } from "@/lib/kitchen";
import { getNutritionData } from "@/penthouse/data/server";
import { Badge, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { DailyColumns, WeeklyColumns } from "@/components/charts";
import { DeleteButton } from "../training/delete-button";
import { PantryTable } from "./pantry-table";
import { removeRun } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kitchen" };

const SOURCE: Record<string, string> = { receipt: "Photo", text: "Typed", manual: "Form", lidl: "Lidl Plus", api: "API" };

export default async function KitchenPage() {
  const today = todayISO();
  const weeks = lastNWeeks(8, today);
  const from = weeks[0];
  const sql = await db();
  const [n, runs, meals] = await Promise.all([
    getNutritionData(today),
    sql<{ id: number; date: string; store: string; total: number; source: string; items: number }[]>`
      select r.id, r.date, r.store, r.total, r.source, (select count(*)::int from pantry_items p where p.run_id = r.id) as items
      from grocery_runs r order by r.date desc, r.id desc limit 40`,
    sql<{ date: string; protein: number; cost: number | null; kind: string }[]>`
      select date, protein, cost, kind from meals where date >= ${from}`,
  ]);
  const live = n.source === "live";
  const pantry = live ? n.pantry : [];

  // spend per week: grocery runs plus meals out
  const weekOf = (d: string) => weeks.filter((w) => w <= d).at(-1);
  const spend = new Map(weeks.map((w) => [w, 0]));
  for (const r of runs) if (r.date >= from) spend.set(weekOf(r.date)!, spend.get(weekOf(r.date)!)! + r.total);
  for (const m of meals) if (m.kind === "out" && m.cost) spend.set(weekOf(m.date)!, spend.get(weekOf(m.date)!)! + m.cost);
  const spendWeeks = weeks.map((w) => ({ label: fShort(w), spend: Math.round(spend.get(w)! * 100) / 100 }));
  const last4 = spendWeeks.slice(-4).reduce((a, w) => a + w.spend, 0);

  const days = lastNDays(28, today);
  const protein = new Map(days.map((d) => [d, 0]));
  for (const m of meals) if (protein.has(m.date)) protein.set(m.date, protein.get(m.date)! + m.protein);
  const proteinDays = days.map((d) => ({ date: d, label: fShort(d), value: Math.round(protein.get(d)!) }));
  const logged = proteinDays.slice(-7).filter((d) => d.value > 0);
  const avgProtein = logged.length ? Math.round(logged.reduce((a, d) => a + d.value, 0) / logged.length) : null;

  return (
    <>
      <PageHeader title="Kitchen" sub={fLong(today)} />
      {!live && <p className="mb-4 text-[13.5px] text-ink-3">Nothing logged yet. Add a shop from the kitchen in the penthouse view, or sync Lidl Plus receipts.</p>}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Spent, 7 days" value={money(live ? n.spend.week : 0)} meta={live ? `${money(n.spend.groceries)} shops · ${money(n.spend.out)} out` : undefined} />
        <Stat label="Spent, 4 weeks" value={money(last4)} meta={`about ${money(last4 / 4)} a week`} />
        <Stat label="In the fridge" value={money(pantry.reduce((a, p) => a + itemCost(p, p.qty), 0))} meta={`${pantry.length} items`} />
        <Stat label="Protein a day" value={avgProtein ?? "–"} unit={avgProtein ? "g" : undefined} meta={`last 7 days, target ${n.targets.protein} g`} />
      </div>

      <div className="grid gap-6">
        <Card title="Fridge and pantry" sub="Change what's left, where it lives, or when to use it by. Amounts also go down when you log a cooked meal.">
          {pantry.length ? <PantryTable items={pantry} /> : <Empty>Nothing here yet.</Empty>}
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Food spending" sub="Groceries plus meals out, per week">
            <WeeklyColumns data={spendWeeks} dataKey="spend" unitLabel="Spent ($)" color="var(--s3)" minTop={20} decimals={2} />
          </Card>
          <Card title="Protein" sub="Grams per day, last 4 weeks">
            <DailyColumns data={proteinDays} unitLabel="Protein (g)" />
          </Card>
        </div>

        <Card title="Shops" sub="Deleting a shop also removes its items from the fridge.">
          {runs.length ? (
            <ul className="divide-y divide-line">
              {runs.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2.5 text-[14px]">
                  <span className="w-16 shrink-0 text-ink-3 tnum">{fShort(r.date)}</span>
                  <span className="min-w-0 flex-1 truncate">{r.store || "Groceries"}</span>
                  <Badge>{SOURCE[r.source] ?? r.source}</Badge>
                  <span className="hidden w-16 text-right text-[13px] text-ink-3 sm:inline">{r.items} items</span>
                  <span className="w-20 text-right font-medium tnum">{money(r.total)}</span>
                  <DeleteButton action={removeRun} id={r.id} label={`shop on ${fShort(r.date)}`} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No shops yet.</Empty>
          )}
        </Card>
      </div>
    </>
  );
}
