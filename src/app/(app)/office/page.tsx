import { PageHeader, RoomTabs, pickTab, Badge } from "@/components/ui";
import { getProfessionalData } from "@/penthouse/data/server";
import { todayISO } from "@/lib/dates";
import { WeekCalendar } from "./calendar";
import { TodoBoard } from "./todos";

export const dynamic = "force-dynamic";
export const metadata = { title: "Office" };

const TABS = ["calendar", "todos"] as const;

export default async function OfficePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = pickTab((await searchParams).tab, TABS);
  const data = await getProfessionalData();
  const today = todayISO();
  const open = data.todos.items.filter((t) => !t.done).length;
  const todayCount = data.calendar.items.filter((e) => e.date === today).length;
  const longDate = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(today + "T12:00:00Z"));

  return (
    <>
      <PageHeader
        eyebrow="Office"
        title={longDate}
        sub={`${todayCount === 0 ? "Nothing" : todayCount === 1 ? "One thing" : `${todayCount} things`} on the calendar today, ${open} open to-do${open === 1 ? "" : "s"}.`}
        actions={data.calendar.source !== "live" && <Badge tone="warn">Calendar not connected</Badge>}
      />
      <RoomTabs
        base="/office"
        active={tab}
        items={[
          { id: "calendar", label: "Calendar" },
          { id: "todos", label: "To-dos", count: open },
        ]}
      />
      {tab === "calendar" ? (
        <WeekCalendar items={data.calendar.items} weekStart={data.calendar.weekStart} today={today} />
      ) : (
        <TodoBoard items={data.todos.items} today={today} />
      )}
    </>
  );
}
