/** Every connector the Office offers. Each one works; OAuth cards hide until their app keys are set. Shown on /connectors and on the bookshelf. */

export type Room = "gym" | "bedroom" | "kitchen" | "office";
export type Method = "google" | "oauth" | "key" | "phone" | "upload" | "paste" | "guide";

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
  { id: "google", name: "Google", rooms: ["office", "kitchen", "gym"], method: "google", env: "GOOGLE_CLIENT_ID",
    blurb: "One login. Your Google calendars show in the Office, Claude reads new email for to-dos, plans and grocery orders, and your workout sheet syncs.",
    feeds: "Calendar and to-dos in the Office, grocery orders in the Kitchen, your workout sheet in the Gym" },
  { id: "apple-notes", name: "iPhone Notes", rooms: ["gym"], method: "phone",
    blurb: "Keep logging in your Notes app. A Shortcut sends your workout note here every evening, so the Gym fills itself.",
    feeds: "Workouts and sets in the Gym" },
  { id: "hevy", name: "Hevy", rooms: ["gym"], method: "key",
    blurb: "Paste your Hevy API key once (Hevy Pro: hevy.com, Settings, Developer). Every workout you finish in Hevy arrives here.",
    feeds: "Workouts and sets in the Gym" },
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
  { id: "calendar", name: "Apple or Outlook calendar", rooms: ["office"], method: "paste",
    blurb: "Apple and Outlook have no login for websites, so you share a private calendar link once. It refreshes on every visit.",
    feeds: "Your week in the Office" },
  { id: "receipt", name: "Paper receipts", rooms: ["kitchen"], method: "upload",
    blurb: "Online grocery orders arrive through Google automatically. For a shop in person, snap the receipt and Claude fills the pantry.",
    feeds: "Pantry and spending in the Kitchen" },
  { id: "sheet", name: "Excel or CSV file", rooms: ["gym"], method: "upload",
    blurb: "No Google account? Upload a workout spreadsheet once. Any layout works; Claude reads the columns.",
    feeds: "Workouts and sets in the Gym" },
  { id: "garmin", name: "Garmin", rooms: ["gym", "bedroom"], method: "guide",
    blurb: "Garmin only opens its API to approved partners. Turn on Garmin's sync to Strava and connect Strava here.",
    feeds: "Runs and workouts through Strava" },
];

export const byId = (id: string) => CONNECTORS.find((c) => c.id === id);
