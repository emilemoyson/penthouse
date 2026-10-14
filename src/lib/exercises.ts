export const MUSCLES = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Quads",
  "Hamstrings",
  "Glutes",
  "Calves",
  "Core",
  "Other",
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const SESSION_KINDS = [
  { id: "push", label: "Push" },
  { id: "pull", label: "Pull" },
  { id: "legs", label: "Legs" },
  { id: "upper", label: "Upper" },
  { id: "lower", label: "Lower" },
  { id: "full", label: "Full body" },
  { id: "other", label: "Other" },
] as const;

export const RUN_KINDS = [
  { id: "easy", label: "Easy" },
  { id: "long", label: "Long" },
  { id: "tempo", label: "Tempo" },
  { id: "intervals", label: "Intervals" },
  { id: "race", label: "Race" },
] as const;

/** kind: compound lifts progress in a 6–10 rep range, isolation in 10–15. */
export type ExerciseDef = { name: string; muscle: Muscle; kind: "compound" | "isolation" };

export const DEFAULT_EXERCISES: ExerciseDef[] = [
  // Chest
  { name: "Flat DB press", muscle: "Chest", kind: "compound" },
  { name: "Incline DB press", muscle: "Chest", kind: "compound" },
  { name: "Bench press", muscle: "Chest", kind: "compound" },
  { name: "Incline bench press", muscle: "Chest", kind: "compound" },
  { name: "Chest press (machine)", muscle: "Chest", kind: "compound" },
  { name: "Pec fly (machine)", muscle: "Chest", kind: "isolation" },
  { name: "Cable chest fly", muscle: "Chest", kind: "isolation" },
  { name: "Dips", muscle: "Chest", kind: "compound" },
  // Shoulders
  { name: "Shoulder press", muscle: "Shoulders", kind: "compound" },
  { name: "Cable lateral raise", muscle: "Shoulders", kind: "isolation" },
  { name: "DB lateral raise", muscle: "Shoulders", kind: "isolation" },
  { name: "Face pull", muscle: "Shoulders", kind: "isolation" },
  { name: "Rear delt fly", muscle: "Shoulders", kind: "isolation" },
  // Triceps
  { name: "Tricep pushdown", muscle: "Triceps", kind: "isolation" },
  { name: "Tricep rope pushdown", muscle: "Triceps", kind: "isolation" },
  { name: "Overhead tricep extension", muscle: "Triceps", kind: "isolation" },
  // Back
  { name: "Pull-up", muscle: "Back", kind: "compound" },
  { name: "Close-grip lat pulldown", muscle: "Back", kind: "compound" },
  { name: "Lat pulldown", muscle: "Back", kind: "compound" },
  { name: "Seated row (machine)", muscle: "Back", kind: "compound" },
  { name: "Cable row", muscle: "Back", kind: "compound" },
  { name: "Barbell row", muscle: "Back", kind: "compound" },
  { name: "DB row", muscle: "Back", kind: "compound" },
  // Biceps
  { name: "DB curl", muscle: "Biceps", kind: "isolation" },
  { name: "Hammer curl", muscle: "Biceps", kind: "isolation" },
  { name: "Cable curl", muscle: "Biceps", kind: "isolation" },
  { name: "Dumbbell (unnamed)", muscle: "Other", kind: "isolation" },
  // Legs
  { name: "Back squat", muscle: "Quads", kind: "compound" },
  { name: "Leg press", muscle: "Quads", kind: "compound" },
  { name: "Bulgarian split squat", muscle: "Quads", kind: "compound" },
  { name: "Leg extension", muscle: "Quads", kind: "isolation" },
  { name: "Romanian deadlift", muscle: "Hamstrings", kind: "compound" },
  { name: "Leg curl", muscle: "Hamstrings", kind: "isolation" },
  { name: "Hip thrust", muscle: "Glutes", kind: "compound" },
  { name: "Deadlift", muscle: "Hamstrings", kind: "compound" },
  { name: "Calf raise", muscle: "Calves", kind: "isolation" },
  // Core
  { name: "Plank", muscle: "Core", kind: "isolation" },
  { name: "Cable crunch", muscle: "Core", kind: "isolation" },
  { name: "Hanging leg raise", muscle: "Core", kind: "isolation" },
];

/** Weekly working-set range per muscle that most hypertrophy research lands on (roughly 10–20). */
export const WEEKLY_SET_RANGE: [number, number] = [10, 20];
