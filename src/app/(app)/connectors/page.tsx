import { db } from "@/lib/db";
import { CONNECTORS, type Room } from "@/lib/connectors/catalog";
import { PROVIDERS } from "@/lib/connectors/oauth";
import { getProfile } from "@/lib/profile";
import { getSessionUser } from "@/lib/session";
import { hasIngestToken } from "@/lib/ingest-tokens";
import { getKV } from "@/lib/db";
import { ConnectorCard, ProfileForm, RequestForm, DeleteAccount, Banner, type Extras, type Status } from "./ui";
import { GoogleCard } from "./google-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Connectors" };

const ROOMS: { id: Room; title: string; sub: string }[] = [
  { id: "gym", title: "Gym", sub: "Workouts, runs and steps" },
  { id: "bedroom", title: "Bedroom", sub: "Sleep and recovery" },
  { id: "kitchen", title: "Kitchen", sub: "Groceries and meals" },
  { id: "office", title: "Office", sub: "Calendar and to-dos" },
];

export default async function ConnectorsPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  const sp = await searchParams;
  const sql = await db();
  const [rows, profile, user, hasKey, calendarUrls] = await Promise.all([
    sql<{ connector: string; status: string; config: Record<string, unknown>; last_sync: Date | null; last_error: string | null }[]>`
      select connector, status, config, last_sync, last_error from user_connectors`,
    getProfile(),
    getSessionUser(),
    hasIngestToken(),
    getKV<string[]>("calendar_urls", []),
  ]);
  const status = new Map<string, Status>(
    rows.map((r) => [
      r.connector,
      {
        connected: r.status === "connected",
        account: typeof r.config?.account === "string" ? r.config.account : null,
        lastSync: r.last_sync ? r.last_sync.toISOString() : null,
        error: r.last_error,
      },
    ]),
  );
  const live = (id: string) => {
    const p = PROVIDERS[id];
    return !p || (!!p.clientId() && !!p.clientSecret());
  };
  const googleRow = rows.find((r) => r.connector === "google");
  const google = CONNECTORS.find((c) => c.id === "google")!;
  const extras: Extras = {
    hasKey,
    calendarUrls,
    shortcutUrl: process.env.OFFICE_SHORTCUT_URL ?? "",
    googleOn: googleRow?.status === "connected",
    sheetName: typeof googleRow?.config?.sheetName === "string" ? googleRow.config.sheetName : null,
    pickerKey: process.env.NEXT_PUBLIC_GOOGLE_PICKER_KEY ?? "",
    appId: process.env.GOOGLE_PROJECT_NUMBER ?? "",
  };
  const count = rows.filter((r) => r.status === "connected").length;
  const first = (profile.name || user?.name || "").split(/\s+/)[0];

  return (
    <div className="mx-auto max-w-[1080px] space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11.5px] font-medium uppercase tracking-[0.2em] text-ink-3">Connectors</div>
          <h1 className="font-serif text-[30px] font-medium leading-tight tracking-[-0.02em]">
            {count ? `${count} connected${first ? `, ${first}` : ""}` : `Welcome${first ? `, ${first}` : ""}. Plug in what you use.`}
          </h1>
          <p className="mt-1 max-w-[640px] text-[14px] text-ink-2">
            Connect once and your Office fills in by itself. New connections bring in the last 14 days straight away, then keep
            updating. Rooms without a connector show sample data, marked as such.
          </p>
        </div>
      </div>

      <Banner connected={sp.connected} error={sp.error} />

      {live("google") && <GoogleCard c={google} status={status.get("google") ?? null} />}

      {ROOMS.map((room) => {
        // Google has its own card above; login cards without app keys stay hidden until they work.
        // Garmin goes through Strava and the sheet picker through Google, so they hide with them.
        const list = CONNECTORS.filter(
          (c) =>
            c.rooms[0] === room.id &&
            c.id !== "google" &&
            (c.method !== "oauth" || live(c.id)) &&
            (c.id !== "garmin" || live("strava")) &&
            (c.method !== "sheet" || live("google")),
        );
        if (!list.length) return null;
        return (
          <section key={room.id} className="space-y-3">
            <div className="flex items-baseline gap-3">
              <h2 className="font-serif text-[21px] font-medium">{room.title}</h2>
              <span className="text-[13px] text-ink-3">{room.sub}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((c) => (
                <ConnectorCard
                  key={c.id}
                  c={c}
                  status={status.get(c.id) ?? null}
                  live={live(c.id)}
                  x={extras}
                />
              ))}
            </div>
          </section>
        );
      })}

      <section className="grid gap-3 lg:grid-cols-2">
        <RequestForm />
        <ProfileForm name={profile.name || user?.name || ""} timezone={profile.timezone} />
      </section>

      <DeleteAccount email={user?.email ?? ""} />
    </div>
  );
}
