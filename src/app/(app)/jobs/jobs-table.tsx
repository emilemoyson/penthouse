"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { ArrowUpRight, Search } from "lucide-react";
import type { Job } from "@/lib/jobs";
import { StatusBadge } from "./status-badge";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "todo", label: "To apply" },
  { id: "active", label: "In progress" },
  { id: "closed", label: "Closed" },
] as const;
const ACTIVE = ["Applied", "To do assessment", "Assessment complete", "Interview", "Final round", "Offer"];
const CLOSED = ["Rejected", "Ghosted", "Withdrawn", "Closed"];

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (s: string | null) => (s ? `${MON[Number(s.slice(5, 7)) - 1]} ${Number(s.slice(8, 10))}` : "–");

export function JobsTable({ jobs }: { jobs: Job[] }) {
  const [f, setF] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return jobs
      .filter((j) => (f === "all" ? true : f === "todo" ? j.status === "To apply" : f === "active" ? ACTIVE.includes(j.status) : CLOSED.includes(j.status)))
      .filter((j) => !t || `${j.company} ${j.role} ${j.bucket} ${j.location}`.toLowerCase().includes(t))
      .sort((a, b) => (b.dateApplied || b.dateAdded || "").localeCompare(a.dateApplied || a.dateAdded || ""));
  }, [jobs, f, q]);
  const count = (id: string) =>
    jobs.filter((j) => (id === "all" ? true : id === "todo" ? j.status === "To apply" : id === "active" ? ACTIVE.includes(j.status) : CLOSED.includes(j.status))).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4 sm:px-6">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((x) => (
            <button
              key={x.id}
              onClick={() => setF(x.id)}
              className={clsx(
                "rounded-full px-3 py-1 text-[12.5px] font-medium transition",
                f === x.id ? "bg-ink text-bg" : "bg-surface-2 text-ink-2 ring-1 ring-inset ring-line hover:text-ink",
              )}
            >
              {x.label} <span className={clsx("ml-0.5 tnum", f === x.id ? "opacity-70" : "text-ink-3")}>{count(x.id)}</span>
            </button>
          ))}
        </div>
        <label className="relative w-full sm:w-64">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company or role" className="field h-9 pl-8 text-[13.5px]" />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-[13.5px]">
          <thead>
            <tr className="border-y border-line bg-surface-2/60 text-left text-[12px] text-ink-3">
              <th className="py-2 pl-5 pr-4 font-medium sm:pl-6">Company & role</th>
              <th className="py-2 pr-4 font-medium">Area</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">Applied</th>
              <th className="py-2 pr-4 font-medium">Deadline</th>
              <th className="py-2 pr-5 font-medium sm:pr-6" />
            </tr>
          </thead>
          <tbody>
            {rows.map((j) => (
              <tr key={j.id || j.company + j.role} className="border-b border-line/70 last:border-0 hover:bg-surface-2/50">
                <td className="max-w-[360px] py-3 pl-5 pr-4 sm:pl-6">
                  <div className="font-medium">{j.company}</div>
                  <div className="truncate text-[12.5px] text-ink-3" title={j.role}>
                    {j.role}
                  </div>
                </td>
                <td className="py-3 pr-4 text-[12.5px] text-ink-2">
                  {j.bucket.replace(/^\d+\s*/, "")}
                  <div className="text-ink-3">{j.level}</div>
                </td>
                <td className="py-3 pr-4">
                  <StatusBadge status={j.status} />
                </td>
                <td className="py-3 pr-4 tnum text-ink-2">{short(j.dateApplied)}</td>
                <td className="py-3 pr-4 tnum text-ink-2">{short(j.deadline)}</td>
                <td className="py-3 pr-5 text-right sm:pr-6">
                  {j.link && (
                    <a
                      href={j.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12.5px] font-medium text-accent-ink hover:bg-accent-soft"
                    >
                      Posting <ArrowUpRight size={13} />
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-ink-3">
                  Nothing matches.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
