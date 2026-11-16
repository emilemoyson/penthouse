"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";
import { pickerToken, saveSheet } from "./actions";

const btn = "inline-flex h-8 items-center justify-center gap-1.5 rounded-[9px] px-3 text-[13px] font-medium transition disabled:opacity-60";
const primary = clsx(btn, "bg-ink text-bg hover:opacity-90");
const quiet = clsx(btn, "border border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink");

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { gapi?: any; google?: any }
}

let pickerLoaded: Promise<void> | null = null;
function loadPicker(): Promise<void> {
  pickerLoaded ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://apis.google.com/js/api.js";
    s.async = true;
    s.onload = () => window.gapi.load("picker", { callback: () => resolve(), onerror: () => reject(new Error("picker")) });
    s.onerror = () => reject(new Error("Couldn't load Google's file picker."));
    document.head.appendChild(s);
  });
  return pickerLoaded;
}

export function SheetPicker({ sheetName, pickerKey, appId }: { sheetName: string | null; pickerKey: string; appId: string }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);

  const open = async () => {
    setMsg(null);
    setBusy(true);
    try {
      const [tok] = await Promise.all([pickerToken(), loadPicker()]);
      if (!tok.ok || !tok.token) throw new Error(tok.message);
      const g = window.google.picker;
      const view = new g.DocsView(g.ViewId.SPREADSHEETS).setMode(g.DocsViewMode.LIST).setOwnedByMe(true);
      const picker = new g.PickerBuilder()
        .addView(view)
        .addView(new g.DocsView(g.ViewId.SPREADSHEETS).setMode(g.DocsViewMode.LIST).setOwnedByMe(false))
        .setOAuthToken(tok.token)
        .setDeveloperKey(pickerKey)
        .setAppId(appId)
        .setTitle("Choose your workout sheet")
        .setCallback((d: any) => {
          if (d.action === g.Action.PICKED && d.docs?.[0]?.id) {
            const id = String(d.docs[0].id);
            start(async () => {
              const r = await saveSheet(id);
              setMsg({ ok: r.ok, text: r.message });
            });
          }
        })
        .build();
      picker.setVisible(true);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't open the picker." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5">
      {sheetName && <p className="text-[12.5px] leading-relaxed text-ink-2">Reading <b>{sheetName}</b>. New rows reach the Gym each time you open the Office.</p>}
      {pickerKey && appId ? (
        <button className={sheetName ? quiet : primary} disabled={busy || pending} onClick={open}>
          {pending ? "Reading your sheet…" : sheetName ? "Change sheet" : "Choose your workout sheet"}
        </button>
      ) : (
        <p className="text-[12px] text-ink-3">The sheet picker is being set up.</p>
      )}
      {msg && <p className={clsx("text-[12px]", msg.ok ? "text-good" : "text-bad")}>{msg.text}</p>}
    </div>
  );
}
