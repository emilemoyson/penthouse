import { loadTraining, fmtW } from "@/lib/training";
import { todayISO, fShort } from "@/lib/dates";
import { PageHeader } from "@/components/ui";
import { WorkoutForm, type LastByKind, type LastByExercise, type InitialWorkout } from "./workout-form";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Log workout" };

export default async function LogPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const data = await loadTraining();
  const chrono = [...data.workouts].sort((a, b) => (a.date < b.date ? -1 : 1));

  // Last session per type, for "repeat last push"
  const lastByKind: LastByKind = {};
  for (const w of chrono) {
    const names = [...new Set(w.sets.map((s) => s.exercise))];
    lastByKind[w.kind] = {
      date: fShort(w.date),
      exercises: names.map((n) => {
        const ss = w.sets.filter((s) => s.exercise === n);
        return { name: n, sets: ss.map((s) => ({ weight: s.weight, reps: s.reps })), unit: ss[0].unit };
      }),
    };
  }

  // Last numbers per exercise, shown as a hint
  const lastByExercise: LastByExercise = {};
  for (const w of chrono) {
    const names = [...new Set(w.sets.map((s) => s.exercise))];
    for (const n of names) {
      const ss = w.sets.filter((s) => s.exercise === n);
      const groups: string[] = [];
      let i = 0;
      while (i < ss.length) {
        const wt = ss[i].weight;
        const reps: number[] = [];
        while (i < ss.length && ss[i].weight === wt) reps.push(ss[i++].reps);
        groups.push(`${wt ? fmtW(wt) + " " + ss[0].unit : "BW"} × ${reps.join(", ")}`);
      }
      lastByExercise[n] = { date: fShort(w.date), text: groups.join(" · "), weight: ss[ss.length - 1].weight };
    }
  }

  let initial: InitialWorkout | null = null;
  if (id) {
    const w = data.workouts.find((x) => x.id === Number(id));
    if (!w) notFound();
    const names = [...new Set(w.sets.map((s) => s.exercise))];
    initial = {
      id: w.id,
      date: w.date,
      kind: w.kind,
      notes: w.notes,
      unit: (w.sets[0]?.unit as "lb" | "kg") || data.settings.unit,
      exercises: names.map((n) => ({
        name: n,
        sets: w.sets.filter((s) => s.exercise === n).map((s) => ({ weight: String(s.weight), reps: String(s.reps) })),
      })),
    };
  }

  const library = [...data.exercises.values()].map((e) => ({ name: e.name, muscle: e.muscle, kind: e.kind }));

  return (
    <div className="mx-auto max-w-[760px]">
      <PageHeader title={initial ? "Edit workout" : "Log workout"} sub={initial ? `Changes replace what was saved for this session.` : "Add exercises and sets. Weight carries over to the next set."} />
      <WorkoutForm
        today={todayISO()}
        defaultUnit={data.settings.unit}
        library={library}
        lastByKind={lastByKind}
        lastByExercise={lastByExercise}
        initial={initial}
      />
    </div>
  );
}
