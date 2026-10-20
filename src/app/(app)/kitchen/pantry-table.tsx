"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";
import type { PantryItem } from "@/penthouse/data/types";
import { fmtQty, itemCost, money, PLACES, USE_SOON_DAYS } from "@/lib/kitchen";
import { removePantryItem, setPantryPlace, setPantryQty, setPantryUseBy } from "./actions";

const PLACE_LABEL = { fridge: "Fridge", freezer: "Freezer", pantry: "Pantry" } as const;

export function PantryTable({ items }: { items: PantryItem[] }) {
  return (
    <div className="-mx-5 overflow-x-auto sm:-mx-6">
      <table className="w-full min-w-[620px] text-[13.5px]">
        <thead>
          <tr className="border-b border-line text-left text-[12px] text-ink-3">
            <th className="py-2 pl-5 font-medium sm:pl-6">Item</th>
            <th className="py-2 font-medium">Where</th>
            <th className="py-2 font-medium">Left</th>
            <th className="py-2 text-right font-medium">Value</th>
            <th className="py-2 pl-4 font-medium">Use by</th>
            <th className="py-2 pr-5 sm:pr-6" />
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <Row key={p.id} p={p} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ p }: { p: PantryItem }) {
  const [qty, setQty] = useState(String(Math.round(p.qty * 10) / 10));
  const [pending, start] = useTransition();
  const tone = p.daysLeft < 0 ? "text-bad" : p.daysLeft <= USE_SOON_DAYS ? "text-warn" : "text-ink-3";
  const saveQty = () => {
    const v = Number(qty);
    if (Number.isFinite(v) && v !== p.qty) start(() => setPantryQty(p.id, Math.max(0, v)));
  };
  return (
    <tr className={clsx("border-b border-line/60 last:border-0", pending && "opacity-50")}>
      <td className="py-1.5 pl-5 sm:pl-6">{p.name}</td>
      <td className="py-1.5">
        <select defaultValue={p.place} onChange={(e) => start(() => setPantryPlace(p.id, e.target.value as PantryItem["place"]))} className="rounded-md bg-transparent py-1 text-ink-2 hover:text-ink">
          {PLACES.map((pl) => (
            <option key={pl} value={pl}>
              {PLACE_LABEL[pl]}
            </option>
          ))}
        </select>
      </td>
      <td className="py-1.5">
        <span className="inline-flex items-center gap-1.5">
          <input
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ""))}
            onBlur={saveQty}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="h-8 w-20 rounded-lg border border-line bg-surface px-2 text-right font-mono text-[13px] tnum focus:border-accent focus:outline-none"
            aria-label={`Amount of ${p.name} left`}
          />
          <span className="text-[12px] text-ink-3">{p.unit}</span>
          <span className="text-[12px] text-ink-3">of {fmtQty(p.qty_start, p.unit)}</span>
        </span>
      </td>
      <td className="py-1.5 text-right tnum">{money(itemCost(p, p.qty))}</td>
      <td className="py-1.5 pl-4">
        <input
          type="date"
          defaultValue={p.use_by ?? ""}
          onChange={(e) => start(() => setPantryUseBy(p.id, e.target.value || null))}
          className={clsx("h-8 rounded-lg bg-transparent text-[12.5px]", tone)}
          aria-label={`Use by date for ${p.name}`}
        />
      </td>
      <td className="py-1.5 pr-5 text-right sm:pr-6">
        <button onClick={() => start(() => removePantryItem(p.id))} className="rounded-lg px-2 py-1 text-[12.5px] text-ink-3 hover:bg-surface-2 hover:text-bad">
          Gone
        </button>
      </td>
    </tr>
  );
}
