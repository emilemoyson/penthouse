import { after } from "next/server";
import { rootSql } from "../db";
import { canSync, runSync } from "./sync";

/**
 * Called when a signed-in user opens a page: any OAuth connection not synced in the last hour
 * refreshes in the background (after the response is sent), so new runs and nights keep arriving.
 */
export async function refreshStale(userId: string) {
  try {
    // claim and select in one statement, so parallel page loads don't both sync
    const rows = await rootSql()<{ connector: string }[]>`
      update user_connectors set last_sync = now()
      where user_id = ${userId} and status = 'connected' and secret is not null
        and (last_sync is null or last_sync < now() - interval '1 hour')
      returning connector`;
    const due = rows.map((r) => r.connector).filter(canSync);
    if (!due.length) return;
    after(async () => {
      for (const c of due) await runSync(userId, c, 3);
    });
  } catch {
    // never block a page on a sync
  }
}
