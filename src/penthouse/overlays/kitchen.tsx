"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import clsx from "clsx";
import { Camera, ChevronDown, Keyboard, Minus, Plus, Table2, Trash2, X } from "lucide-react";
import type { NutritionData, PantryItem } from "../data/types";
import { useNutritionData } from "../data/hooks";
import { addMeal, cookMeal, deleteMeal, eatItem, finishPantryItem, parseGroceries, saveGroceryRun } from "../data/actions";
import { fmtQty, INPUT_UNITS, itemCost, itemMacros, money, perBase, perLabel, PLACES, USE_SOON_DAYS } from "@/lib/kitchen";
import { Columns, GlassCard, Ring } from "./glass";
import { SourceBar, Tabs, dow } from "./panels";

/* ====================================================================== */
/* 🍳 Kitchen → useNutritionData                                           */
/* ====================================================================== */

const MACROS = [
  { k: "protein", label: "Protein", color: "#3987e5" },
  { k: "carbs", label: "Carbs", color: "#d95926" },
  { k: "fat", label: "Fats", color: "#199e70" },
] as const;

const PLACE_LABEL = { fridge: "Fridge", freezer: "Freezer", pantry: "Pantry" } as const;
const r1 = (v: number) => Math.round(v * 10) / 10;

export function NutritionPanel({ initial }: { initial: NutritionData }) {
  const { data, loading, refresh, setData } = useNutritionData(initial);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<NutritionData>) => start(async () => setData(await fn()));
  const t = data.totals;
  const left = data.targets.kcal - t.kcal;
  const live = data.source === "live";

  return (
    <div className="space-y-3">
      <SourceBar source={data.source} hint="add groceries or log a meal" loading={loading || pending} onRefresh={refresh} />
      <div className="grid grid-cols-[auto_1fr] items-center gap-5 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
        <Ring value={t.kcal / data.targets.kcal} color="#ffcb6b" size={118}>
          <div>
            <div className="text-[24px] font-semibold leading-none tnum">{t.kcal.toLocaleString()}</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/50">of {data.targets.kcal.toLocaleString()} kcal</div>
          </div>
        </Ring>
        <div>
          <div className="text-[12px] text-white/50">{left >= 0 ? "Left today" : "Over target"}</div>
          <div className="text-[28px] font-semibold tracking-tight tnum">
            {Math.abs(left).toLocaleString()} <span className="text-[14px] font-normal text-white/45">kcal</span>
          </div>
          <div className="mt-1 text-[12px] text-white/50">
            {data.meals.length} meals logged{data.costToday > 0 && ` · ${money(data.costToday)} of food`}
          </div>
        </div>
      </div>

      {/* macro grid */}
      <div className="grid grid-cols-3 gap-2">
        {MACROS.map((m) => {
          const v = Math.round(t[m.k]);
          const target = data.targets[m.k];
          return (
            <div key={m.k} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3">
              <div className="flex items-center gap-1.5 text-[11.5px] text-white/55">
                <span className="size-2 rounded-[2px]" style={{ background: m.color }} />
                {m.label}
              </div>
              <div className="mt-1 text-[22px] font-semibold leading-none tnum">
                {v}
                <span className="ml-0.5 text-[12px] font-normal text-white/40">/ {target}g</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (v / target) * 100)}%`, background: m.color, boxShadow: `0 0 10px ${m.color}aa` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* money */}
      <div className="grid grid-cols-3 gap-2">
        <Tile label="Spent, 7 days" value={money(data.spend.week)} sub={`${money(data.spend.groceries)} shops · ${money(data.spend.out)} out`} />
        <Tile label="Food today" value={money(data.costToday)} sub={data.meals.some((m) => m.cost == null) ? "some meals have no price" : "eaten, not bought"} />
        <Tile label="Protein per $" value={data.proteinPerDollar == null ? "–" : `${Math.round(data.proteinPerDollar)}g`} sub="last 7 days" />
      </div>

      <PantryCard data={data} live={live} pending={pending} run={run} />
      <MealCard data={data} live={live} pending={pending} run={run} />

      <div className="grid gap-3 sm:grid-cols-2">
        <GlassCard title="Calories, 7 days" right={<span className="text-[11px] text-white/40">target {data.targets.kcal}</span>}>
          <Columns values={data.week.map((w) => w.kcal)} labels={data.week.map((w) => dow(w.date))} color="#ffcb6b" target={data.targets.kcal} format={(v) => `${v} kcal`} height={96} />
        </GlassCard>
        <GlassCard title="Spending, 7 days">
          <Columns
            values={data.spend.days.map((d) => Math.round((d.groceries + d.out) * 100) / 100)}
            labels={data.spend.days.map((d) => dow(d.date))}
            color="#23b58a"
            format={(v) => money(v)}
            height={96}
          />
        </GlassCard>
      </div>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: ReactNode; sub: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3">
      <div className="text-[11.5px] text-white/55">{label}</div>
      <div className="mt-1 text-[20px] font-semibold leading-none tnum">{value}</div>
      <div className="mt-1.5 truncate text-[11px] text-white/40">{sub}</div>
    </div>
  );
}

type Run = (fn: () => Promise<NutritionData>) => void;

/* ---------------------------------------------------------------------- */
/* Fridge                                                                  */
/* ---------------------------------------------------------------------- */

function PantryCard({ data, live, pending, run }: { data: NutritionData; live: boolean; pending: boolean; run: Run }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const soon = data.pantry.filter((p) => p.daysLeft <= USE_SOON_DAYS);
  const rest = data.pantry.filter((p) => p.daysLeft > USE_SOON_DAYS);
  const value = data.pantry.reduce((a, p) => a + itemCost(p, p.qty), 0);
  // use-soon items always show; the rest fill up to 6 rows until opened
  const shown = open ? rest : rest.slice(0, Math.max(0, 6 - soon.length));

  return (
    <GlassCard
      title="Fridge"
      right={
        <button onClick={() => setAdding((a) => !a)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-white/70 hover:bg-white/10 hover:text-white">
          {adding ? <X size={13} /> : <Plus size={13} />} {adding ? "Cancel" : "Add groceries"}
        </button>
      }
    >
      {adding && (
        <GroceryAdder
          receipts={data.receipts}
          onDone={(next) => {
            run(async () => next);
            setAdding(false);
          }}
        />
      )}
      {data.pantry.length > 0 ? (
        <>
          <div className="mb-2 text-[12px] text-white/45">
            {data.pantry.length} items · {money(value)} worth{soon.length > 0 && ` · ${soon.length} to use soon`}
          </div>
          {soon.length > 0 && <PantryList items={soon} live={live} pending={pending} run={run} />}
          {PLACES.map((pl) => {
            const items = shown.filter((p) => p.place === pl);
            return items.length ? (
              <div key={pl} className="mt-2">
                <div className="mb-0.5 text-[11px] uppercase tracking-[0.08em] text-white/35">{PLACE_LABEL[pl]}</div>
                <PantryList items={items} live={live} pending={pending} run={run} />
              </div>
            ) : null;
          })}
          {rest.length > shown.length || open ? (
            <button onClick={() => setOpen((o) => !o)} className="mt-1 inline-flex items-center gap-1 text-[12px] text-white/50 hover:text-white">
              <ChevronDown size={13} className={clsx("transition", open && "rotate-180")} />
              {open ? "Show less" : `Show all ${data.pantry.length}`}
            </button>
          ) : null}
        </>
      ) : (
        !adding && <div className="py-1 text-[13px] text-white/45">Nothing here yet. Add your last shop to start.</div>
      )}
    </GlassCard>
  );
}

function PantryList({ items, live, pending, run }: { items: PantryItem[]; live: boolean; pending: boolean; run: Run }) {
  return (
    <ul className="divide-y divide-white/[0.06]">
      {items.map((p) => {
        const one = p.unit === "item" || p.unit === "serving";
        return (
          <li key={p.id} className="group flex items-center gap-2.5 py-1.5 text-[13px]">
            <span
              className={clsx("size-1.5 shrink-0 rounded-full", p.daysLeft < 0 ? "bg-rose-400" : p.daysLeft <= USE_SOON_DAYS ? "bg-amber-300" : "bg-white/20")}
              title={p.daysLeft < 0 ? "Past its date" : `${p.daysLeft} days left`}
            />
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            <span className="w-16 text-right font-mono text-[11.5px] text-white/50">{fmtQty(p.qty, p.unit)}</span>
            <span className="hidden w-14 text-right text-[11.5px] text-white/40 tnum sm:inline">{money(itemCost(p, p.qty))}</span>
            <span className={clsx("w-12 text-right text-[11px] tnum", p.daysLeft < 0 ? "text-rose-300" : p.daysLeft <= USE_SOON_DAYS ? "text-amber-300" : "text-white/35")}>
              {p.daysLeft < 0 ? "past" : p.daysLeft === 0 ? "today" : `${p.daysLeft}d`}
            </span>
            {live && (
              <span className="flex w-[5.5rem] justify-end gap-0.5 opacity-0 transition group-hover:opacity-100 max-sm:opacity-100">
                {one && (
                  <button
                    disabled={pending}
                    onClick={() => run(() => eatItem(p.id, 1))}
                    className="rounded-md px-1.5 py-0.5 text-[11px] text-white/60 hover:bg-white/10 hover:text-white"
                    title={`Log one ${p.unit === "serving" ? "serving" : ""} as a meal`}
                  >
                    Eat 1
                  </button>
                )}
                <button disabled={pending} onClick={() => run(() => finishPantryItem(p.id))} className="rounded-md px-1.5 py-0.5 text-[11px] text-white/40 hover:bg-white/10 hover:text-rose-300" title="Used up or thrown out">
                  Gone
                </button>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------------------------------------------------------------- */
/* Add groceries: photo, typed, or form                                    */
/* ---------------------------------------------------------------------- */

type Row = {
  name: string;
  qty: string;
  unit: string;
  price: string;
  place: (typeof PLACES)[number];
  macros?: { kcal_per: number; protein_per: number; carbs_per: number; fat_per: number; use_by: string | null };
};
const blankRow = (): Row => ({ name: "", qty: "1", unit: "item", price: "", place: "fridge" });

/** Shrinks a phone photo to a JPEG under ~1 MB so it fits through a server action. */
async function shrinkPhoto(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85).split(",")[1];
}

function GroceryAdder({ receipts, onDone }: { receipts: boolean; onDone: (next: NutritionData) => void }) {
  const [mode, setMode] = useState<"photo" | "text" | "form">(receipts ? "photo" : "form");
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([blankRow()]);
  const [store, setStore] = useState("");
  const [date, setDate] = useState("");
  const [total, setTotal] = useState("");
  const [drafted, setDrafted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const read = (input: Parameters<typeof parseGroceries>[0]) =>
    start(async () => {
      setError(null);
      const res = await parseGroceries(input);
      if (!res.ok) return setError(res.error);
      const d = res.draft;
      setRows(
        d.items.map((i) => ({
          name: i.name,
          qty: String(r1(i.qty)),
          unit: i.unit,
          price: i.price.toFixed(2),
          place: i.place,
          macros: { kcal_per: i.kcal_per, protein_per: i.protein_per, carbs_per: i.carbs_per, fat_per: i.fat_per, use_by: i.use_by },
        })),
      );
      setStore(d.store);
      setDate(d.date ?? "");
      setTotal(d.total != null ? d.total.toFixed(2) : "");
      setDrafted(true);
      setMode("form");
    });

  const save = () =>
    start(async () => {
      const items = rows
        .filter((r) => r.name.trim())
        .map((r) => ({ name: r.name, qty: Number(r.qty) || 1, unit: r.unit, price: Number(r.price) || 0, place: r.place, ...(r.macros ?? {}) }));
      if (!items.length) return;
      const next = await saveGroceryRun({ store, date: date || undefined, total: total ? Number(total) : undefined, source: drafted ? (text ? "text" : "receipt") : "manual", items });
      onDone(next);
    });

  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const sum = rows.reduce((a, r) => a + (Number(r.price) || 0), 0);

  return (
    <div className="mb-3 space-y-2.5 rounded-xl border border-white/[0.08] bg-black/20 p-3">
      {receipts && (
        <Tabs
          value={mode}
          onChange={setMode}
          items={[
            { id: "photo", label: "Photo", icon: Camera },
            { id: "text", label: "Type it", icon: Keyboard },
            { id: "form", label: drafted ? "Check" : "Form", icon: Table2 },
          ]}
        />
      )}
      {mode === "photo" && (
        <label className={clsx("flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/20 text-[12.5px] text-white/60 hover:border-white/40 hover:text-white", busy && "pointer-events-none opacity-60")}>
          <Camera size={18} />
          {busy ? "Reading the receipt…" : "Take or choose a photo of the receipt"}
          <span className="text-[11px] text-white/35">A screenshot of a digital receipt works too</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                read({ image: { data: await shrinkPhoto(f), mediaType: "image/jpeg" } });
              } catch {
                setError("Couldn't open that image. Try a JPEG or PNG.");
              }
            }}
          />
        </label>
      )}
      {mode === "text" && (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder={"Trader Joe's: 2lb chicken thighs 9.40, dozen eggs 4.99, 32oz greek yogurt 5.99, spinach 2.49"}
            className="glass-field h-auto resize-none py-2 leading-snug"
          />
          <button disabled={busy || !text.trim()} onClick={() => read({ text })} className="h-9 w-full rounded-lg bg-white/90 text-[13px] font-medium text-black transition hover:bg-white disabled:opacity-40">
            {busy ? "Reading…" : "Read it"}
          </button>
        </div>
      )}
      {mode === "form" && (
        <div className="space-y-2">
          {drafted && <div className="text-[12px] text-white/50">Check the items, then save. Macros are filled in for you.</div>}
          <div className="grid grid-cols-[1fr_7.5rem_7rem] gap-2">
            <input value={store} onChange={(e) => setStore(e.target.value)} placeholder="Store" className="glass-field" />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="glass-field [color-scheme:dark]" />
            <input inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value.replace(/[^\d.]/g, ""))} placeholder={`Total ${sum ? sum.toFixed(2) : ""}`} className="glass-field font-mono" />
          </div>
          <div className="space-y-1.5">
            {rows.map((r, i) => (
              <div key={i}>
                <div className="grid grid-cols-[1fr_3.6rem_4.4rem_4.4rem_1.5rem] gap-1.5 max-sm:grid-cols-[1fr_3.4rem_4.2rem_1.5rem]">
                  <input value={r.name} onChange={(e) => set(i, { name: e.target.value, macros: undefined })} placeholder="Item" className="glass-field" />
                  <input inputMode="decimal" value={r.qty} onChange={(e) => set(i, { qty: e.target.value.replace(/[^\d.]/g, "") })} className="glass-field px-2 font-mono" aria-label="Amount" />
                  <select value={r.unit} onChange={(e) => set(i, { unit: e.target.value })} className="glass-field px-1.5" aria-label="Unit">
                    {[...new Set([r.unit, ...INPUT_UNITS])].map((u) => (
                      <option key={u} value={u} className="bg-[#1b1726]">
                        {u}
                      </option>
                    ))}
                  </select>
                  <input inputMode="decimal" value={r.price} onChange={(e) => set(i, { price: e.target.value.replace(/[^\d.]/g, "") })} placeholder="$" className="glass-field px-2 font-mono max-sm:col-start-2 max-sm:row-start-2" aria-label="Price" />
                  <button onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : [blankRow()]))} className="text-white/30 hover:text-rose-300 max-sm:col-start-4 max-sm:row-start-1" aria-label="Remove">
                    <X size={14} />
                  </button>
                </div>
                <div className="mt-1 flex items-center gap-2 pl-1 text-[11px] text-white/40">
                  <select value={r.place} onChange={(e) => set(i, { place: e.target.value as Row["place"] })} className="rounded bg-transparent text-white/55 outline-none">
                    {PLACES.map((p) => (
                      <option key={p} value={p} className="bg-[#1b1726]">
                        {PLACE_LABEL[p]}
                      </option>
                    ))}
                  </select>
                  {r.macros && (
                    <span className="truncate font-mono">
                      {Math.round(r.macros.kcal_per)} kcal · P{r1(r.macros.protein_per)} per {perLabel(r.unit)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setRows((rs) => [...rs, blankRow()])} className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-[12.5px] text-white/70 ring-1 ring-inset ring-white/10 hover:bg-white/10 hover:text-white">
              <Plus size={13} /> Item
            </button>
            <button disabled={busy || !rows.some((r) => r.name.trim())} onClick={save} className="h-9 flex-1 rounded-lg bg-white/90 text-[13px] font-medium text-black transition hover:bg-white disabled:opacity-40">
              {busy ? "Saving…" : `Save ${rows.filter((r) => r.name.trim()).length} items`}
            </button>
          </div>
          {!drafted && (
            <div className="text-[11px] text-white/35">
              {receipts ? "Leave out macros: they're looked up or estimated when you save." : "Add ANTHROPIC_API_KEY to fill in macros and read receipt photos."}
            </div>
          )}
        </div>
      )}
      {error && <div className="text-[12px] text-rose-300">{error}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Meals: cooked from the fridge, eaten out, or quick add                  */
/* ---------------------------------------------------------------------- */

function MealCard({ data, live, pending, run }: { data: NutritionData; live: boolean; pending: boolean; run: Run }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"cook" | "out" | "quick" | null>(null);
  const visible = open ? data.meals : data.meals.slice(-3);
  const done = (fn: () => Promise<NutritionData>) => {
    run(fn);
    setMode(null);
    setOpen(true);
  };

  return (
    <GlassCard
      title="Meals today"
      right={
        <div className="flex gap-0.5">
          {(
            [
              ["cook", "Cooked"],
              ["out", "Ate out"],
              ["quick", "Other"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setMode((m) => (m === id ? null : id))}
              className={clsx("rounded-lg px-2 py-1 text-[12px] font-medium transition", mode === id ? "bg-white/[0.12] text-white" : "text-white/60 hover:bg-white/10 hover:text-white")}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      {mode === "cook" && <CookForm pantry={live ? data.pantry : []} pending={pending} onSave={(input) => done(() => cookMeal(input))} />}
      {mode === "out" && <OutForm pending={pending} onSave={(input) => done(() => addMeal({ ...input, kind: "out" }))} />}
      {mode === "quick" && <QuickForm pending={pending} onSave={(input) => done(() => addMeal({ ...input, kind: "home" }))} />}
      <ul className="divide-y divide-white/[0.06]">
        {visible.map((m) => (
          <li key={m.id} className="group flex items-center gap-3 py-2 text-[13px]">
            <span className="w-11 font-mono text-[11.5px] text-white/40">{m.time || "–"}</span>
            <span className="min-w-0 flex-1 truncate">
              {m.name}
              {m.kind === "out" && <span className="ml-1.5 text-[11px] text-white/35">out</span>}
            </span>
            <span className="hidden font-mono text-[11px] text-white/45 sm:inline">P{Math.round(m.protein)}</span>
            <span className="w-12 text-right text-[12px] text-white/50 tnum">{m.cost != null ? money(m.cost) : ""}</span>
            <span className="w-12 text-right font-medium tnum">{m.kcal}</span>
            {live && (
              <button onClick={() => run(() => deleteMeal(m.id))} className="text-white/25 opacity-0 transition group-hover:opacity-100 hover:text-rose-300" aria-label={`Delete ${m.name}`}>
                <Trash2 size={13} />
              </button>
            )}
          </li>
        ))}
        {!data.meals.length && <li className="py-2 text-[13px] text-white/45">Nothing logged today.</li>}
      </ul>
      {data.meals.length > 3 && (
        <button onClick={() => setOpen((o) => !o)} className="mt-1 inline-flex items-center gap-1 text-[12px] text-white/50 hover:text-white">
          <ChevronDown size={13} className={clsx("transition", open && "rotate-180")} />
          {open ? "Show less" : `Show all ${data.meals.length}`}
        </button>
      )}
    </GlassCard>
  );
}

const saveBtn = "h-9 w-full rounded-lg bg-white/90 text-[13px] font-medium text-black transition hover:bg-white disabled:opacity-40";
const num = (v: string) => v.replace(/[^\d.]/g, "");

/** A sensible first amount: one item or serving, or 150 g/ml. */
const defaultAmount = (p: PantryItem) => String(Math.min(p.qty, perBase(p.unit) === 100 ? 150 : 1));

function CookForm({ pantry, pending, onSave }: { pantry: PantryItem[]; pending: boolean; onSave: (input: Parameters<typeof cookMeal>[0]) => void }) {
  const [name, setName] = useState("");
  const [uses, setUses] = useState<{ id: number; amount: string }[]>([]);
  const [servings, setServings] = useState(1);
  const byId = useMemo(() => new Map(pantry.map((p) => [p.id, p])), [pantry]);
  const unused = pantry.filter((p) => !uses.some((u) => u.id === p.id));

  const tot = uses.reduce(
    (a, u) => {
      const p = byId.get(u.id);
      const amt = Math.min(Number(u.amount) || 0, p?.qty ?? 0);
      if (!p) return a;
      const m = itemMacros(p, amt);
      return { kcal: a.kcal + m.kcal, protein: a.protein + m.protein, cost: a.cost + itemCost(p, amt) };
    },
    { kcal: 0, protein: 0, cost: 0 },
  );

  if (!pantry.length) return <div className="mb-3 rounded-xl bg-black/20 p-3 text-[12.5px] text-white/55">Add groceries to the fridge first, then pick what you cooked with.</div>;

  return (
    <div className="mb-3 space-y-2 rounded-xl border border-white/[0.08] bg-black/20 p-3">
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="What did you make?" className="glass-field" />
      {uses.map((u, i) => {
        const p = byId.get(u.id)!;
        return (
          <div key={u.id} className="flex items-center gap-2 text-[13px]">
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            <input
              inputMode="decimal"
              value={u.amount}
              onChange={(e) => setUses((us) => us.map((x, j) => (j === i ? { ...x, amount: num(e.target.value) } : x)))}
              className="glass-field w-20 px-2 text-right font-mono"
              aria-label={`Amount of ${p.name}`}
            />
            <span className="w-14 text-[11.5px] text-white/45">
              {p.unit} <span className="text-white/30">/ {fmtQty(p.qty, p.unit).replace(/ .*/, "")}</span>
            </span>
            <button onClick={() => setUses((us) => us.filter((_, j) => j !== i))} className="text-white/30 hover:text-rose-300" aria-label="Remove">
              <X size={14} />
            </button>
          </div>
        );
      })}
      {unused.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            const p = byId.get(Number(e.target.value));
            if (p) setUses((us) => [...us, { id: p.id, amount: defaultAmount(p) }]);
          }}
          className="glass-field text-white/60"
        >
          <option value="" className="bg-[#1b1726]">
            + Add an ingredient from the fridge
          </option>
          {unused.map((p) => (
            <option key={p.id} value={p.id} className="bg-[#1b1726]">
              {p.name} ({fmtQty(p.qty, p.unit)} left)
            </option>
          ))}
        </select>
      )}
      <div className="flex items-center justify-between gap-3 text-[12.5px]">
        <span className="flex items-center gap-1.5 text-white/55">
          Servings
          <button onClick={() => setServings((s) => Math.max(1, s - 1))} className="rounded-md p-1 hover:bg-white/10" aria-label="Fewer servings">
            <Minus size={12} />
          </button>
          <span className="w-4 text-center font-medium text-white tnum">{servings}</span>
          <button onClick={() => setServings((s) => Math.min(20, s + 1))} className="rounded-md p-1 hover:bg-white/10" aria-label="More servings">
            <Plus size={12} />
          </button>
        </span>
        {uses.length > 0 && (
          <span className="font-mono text-[11.5px] text-white/60">
            {Math.round(tot.kcal / servings)} kcal · {Math.round(tot.protein / servings)}g protein · {money(tot.cost / servings)}
            {servings > 1 && " each"}
          </span>
        )}
      </div>
      {servings > 1 && <div className="text-[11px] text-white/40">You eat one now. The other {servings - 1} go in the fridge as leftovers.</div>}
      <button
        disabled={pending || !name.trim() || !uses.length}
        onClick={() => onSave({ name, servings, uses: uses.map((u) => ({ itemId: u.id, amount: Number(u.amount) || 0 })).filter((u) => u.amount > 0) })}
        className={saveBtn}
      >
        {pending ? "Saving…" : "Log meal"}
      </button>
    </div>
  );
}

function OutForm({ pending, onSave }: { pending: boolean; onSave: (input: { name: string; cost: number; kcal: number; protein: number }) => void }) {
  const [f, setF] = useState({ name: "", cost: "", kcal: "", protein: "" });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (f.name.trim() && f.cost) onSave({ name: f.name, cost: Number(f.cost), kcal: Number(f.kcal || 0), protein: Number(f.protein || 0) });
      }}
      className="mb-3 grid grid-cols-3 gap-2 rounded-xl border border-white/[0.08] bg-black/20 p-3"
    >
      <input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="What and where?" className="glass-field col-span-3" />
      <input inputMode="decimal" value={f.cost} onChange={(e) => setF({ ...f, cost: num(e.target.value) })} placeholder="Price $" className="glass-field font-mono" />
      <input inputMode="numeric" value={f.kcal} onChange={(e) => setF({ ...f, kcal: num(e.target.value) })} placeholder="kcal" className="glass-field font-mono" />
      <input inputMode="numeric" value={f.protein} onChange={(e) => setF({ ...f, protein: num(e.target.value) })} placeholder="Protein g" className="glass-field font-mono" />
      <button disabled={pending || !f.name.trim() || !f.cost} className={clsx(saveBtn, "col-span-3")}>
        {pending ? "Saving…" : "Log meal out"}
      </button>
    </form>
  );
}

function QuickForm({ pending, onSave }: { pending: boolean; onSave: (input: { name: string; kcal: number; protein: number; carbs: number; fat: number; cost: number | null }) => void }) {
  const [f, setF] = useState({ name: "", kcal: "", protein: "", carbs: "", fat: "", cost: "" });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (f.name.trim() && f.kcal)
          onSave({ name: f.name, kcal: Number(f.kcal), protein: Number(f.protein || 0), carbs: Number(f.carbs || 0), fat: Number(f.fat || 0), cost: f.cost ? Number(f.cost) : null });
      }}
      className="mb-3 grid grid-cols-5 gap-2 rounded-xl border border-white/[0.08] bg-black/20 p-3"
    >
      <input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="What did you eat?" className="glass-field col-span-5" />
      {(["kcal", "protein", "carbs", "fat", "cost"] as const).map((k) => (
        <input
          key={k}
          inputMode="decimal"
          value={f[k]}
          onChange={(e) => setF({ ...f, [k]: num(e.target.value) })}
          placeholder={k === "kcal" ? "kcal" : k === "cost" ? "$" : `${k[0].toUpperCase()}${k.slice(1)} g`}
          className="glass-field px-2 font-mono"
        />
      ))}
      <button disabled={pending || !f.name.trim() || !f.kcal} className={clsx(saveBtn, "col-span-5")}>
        {pending ? "Saving…" : "Log meal"}
      </button>
    </form>
  );
}
