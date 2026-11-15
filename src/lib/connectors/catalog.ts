/** Every connector the Office knows, including ones that are planned. Shown on /connectors and on the bookshelf. */

export type Room = "gym" | "bedroom" | "kitchen" | "office";
export type Method = "oauth" | "phone" | "upload" | "paste" | "guide" | "soon";

export type Connector = {
  id: string;
  name: string;
  rooms: Room[];
  method: Method;
  blurb: string;
  /** what lands where, in plain words */
  feeds: string;
  /** env var that must be set for an OAuth connector to be live */
  env?: string;
};

export const CONNECTORS: Connector[] = [
  { id: "strava", name: "Strava", rooms: ["gym"], method: "oauth", env: "STRAVA_CLIENT_ID",
    blurb: "Log in once. Runs, rides and workouts from the last 14 days arrive now, new ones each time you open the Office.",
    feeds: "Runs and workouts in the Gym" },
  { id: "whoop", name: "WHOOP", rooms: ["bedroom", "gym"], method: "oauth", env: "WHOOP_CLIENT_ID",
    blurb: "Log in once. Sleep, recovery, HRV and workouts from the last 14 days, then each time you open the Office.",
    feeds: "Sleep and recovery in the Bedroom, workouts in the Gym" },
  { id: "notion", name: "Notion", rooms: ["gym"], method: "oauth", env: "NOTION_CLIENT_ID",
    blurb: "Log in once and pick the page or database where you log workouts. Claude reads it again each time you open the Office.",
    feeds: "Workouts and sets in the Gym" },
  { id: "apple-health", name: "Apple Watch / Apple Health", rooms: ["bedroom", "gym"], method: "phone",
    blurb: "Apple keeps Health data on the iPhone. A two-minute setup in the Health Auto Export app sends it here automatically.",
    feeds: "Sleep in the Bedroom, runs, workouts and steps in the Gym" },
  { id: "apple-notes", name: "iPhone Notes", rooms: ["gym"], method: "phone",
    blurb: "Paste your workout note once to fill the Gym, then add our Shortcut so it sends itself every evening.",
    feeds: "Workouts and sets in the Gym" },
  { id: "sheet", name: "Excel or Google Sheets", rooms: ["gym"], method: "upload",
    blurb: "Upload your workout spreadsheet (xlsx or csv). Any layout works; Claude reads the columns.",
    feeds: "Workouts and sets in the Gym" },
  { id: "garmin", name: "Garmin", rooms: ["gym", "bedroom"], method: "guide",
    blurb: "Garmin only opens its API to approved partners (applied). Until then, turn on Garmin's sync to Strava and connect Strava here.",
    feeds: "Runs and workouts through Strava" },
  { id: "calendar", name: "Google, Outlook or iCloud Calendar", rooms: ["office"], method: "paste",
    blurb: "Paste your calendar's secret iCal address. It stays private and refreshes on every visit.",
    feeds: "Your week in the Office" },
  { id: "receipt", name: "Grocery receipts", rooms: ["kitchen"], method: "upload",
    blurb: "Snap or upload a receipt. Claude reads the items, sizes and macros into your pantry.",
    feeds: "Pantry and spending in the Kitchen" },
  { id: "oura", name: "Oura", rooms: ["bedroom"], method: "soon", blurb: "Sleep and readiness.", feeds: "Bedroom" },
  { id: "fitbit", name: "Fitbit", rooms: ["bedroom", "gym"], method: "soon", blurb: "Sleep, steps and workouts.", feeds: "Bedroom and Gym" },
  { id: "hevy", name: "Hevy / Strong", rooms: ["gym"], method: "soon", blurb: "Lifting apps. Their CSV export already works with the spreadsheet upload.", feeds: "Gym" },
  { id: "mfp", name: "MyFitnessPal / Cronometer", rooms: ["kitchen"], method: "soon", blurb: "Meals and macros.", feeds: "Kitchen" },
  { id: "todoist", name: "Todoist", rooms: ["office"], method: "soon", blurb: "Tasks.", feeds: "Office to-dos" },
];

export const byId = (id: string) => CONNECTORS.find((c) => c.id === id);
