import { addDays, lastNDays } from "@/lib/dates";
import type { EmailSummary, Meal, SleepNight } from "./types";

/* Realistic placeholders, shown (and labelled as samples) until a real source is connected. */

export function sampleSleep(today: string): { lastNight: SleepNight; week: { date: string; totalMin: number; recovery: number | null }[] } {
  const mins = [414, 444, 372, 468, 426, 492, 432];
  const rec = [71, 76, 58, 82, 74, 88, 78];
  const days = lastNDays(7, today);
  return {
    lastNight: {
      date: today,
      totalMin: 432,
      deepMin: 75,
      remMin: 98,
      lightMin: 238,
      awakeMin: 21,
      recovery: 78,
      hrv: 61,
      rhr: 52,
      bedtime: "23:48",
      waketime: "07:15",
    },
    week: days.map((d, i) => ({ date: d, totalMin: mins[i], recovery: rec[i] })),
  };
}

export function sampleEmails(today: string): EmailSummary[] {
  const at = (n: number, h: number) => `${addDays(today, -n)}T${String(h).padStart(2, "0")}:00:00Z`;
  return [
    { id: "s1", receivedAt: at(0, 14), sender: "Recruiting · Example Capital", subject: "Application received", tag: "Job", bullets: ["Application confirmed for the 2027 analyst role", "Online assessment link arrives within a week"] },
    { id: "s2", receivedAt: at(0, 11), sender: "Program office", subject: "Deadline reminder", tag: "Action", bullets: ["Short form due Friday", "Submit through the student portal"] },
    { id: "s3", receivedAt: at(1, 18), sender: "Student club", subject: "Event logistics", tag: "Club", bullets: ["Room confirmed", "Two volunteers needed for check-in from 6pm"] },
    { id: "s4", receivedAt: at(2, 9), sender: "Course platform", subject: "Weekly progress", tag: "School", bullets: ["Summary of this week's progress", "Next module due Sunday"] },
  ];
}

export function sampleMeals(today: string): Meal[] {
  return [
    { id: -1, date: today, time: "08:10", name: "Overnight oats, whey, berries", kcal: 610, protein: 42, carbs: 78, fat: 14 },
    { id: -2, date: today, time: "12:45", name: "Chicken rice bowl", kcal: 720, protein: 52, carbs: 86, fat: 18 },
    { id: -3, date: today, time: "16:00", name: "Greek yogurt + granola", kcal: 330, protein: 24, carbs: 38, fat: 9 },
    { id: -4, date: today, time: "19:30", name: "Salmon, potatoes, greens", kcal: 520, protein: 30, carbs: 10, fat: 20 },
  ];
}

export function sampleKcalWeek(today: string) {
  const v = [2480, 2710, 2350, 2890, 2600, 2420, 2180];
  return lastNDays(7, today).map((d, i) => ({ date: d, kcal: v[i] }));
}
