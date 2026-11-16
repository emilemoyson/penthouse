/** Every connector the Office offers. Each one works; OAuth cards hide until their app keys are set. Shown on /connectors and on the bookshelf. */

export type Room = "gym" | "bedroom" | "kitchen" | "office";
export type Method = "google" | "sheet" | "oauth" | "phone" | "upload" | "paste" | "guide";

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
  { id: "workout-sheet", name: "Workout sheet", rooms: ["gym"], method: "sheet",
    blurb: "Log workouts in a Google Sheet? Pick it once. The Office can only open the file you choose.",
    feeds: "Workouts and sets in the Gym, new rows each time you open the Office" },
  { id: "apple-notes", name: "iPhone Notes", rooms: ["gym"], method: "phone",
    blurb: "Keep logging in your Notes app. Add the Office Shortcut once and your workout note reaches the Gym every evening.",
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
  { id: "garmin", name: "Garmin", rooms: ["gym", "bedroom"], method: "guide",
    blurb: "Garmin only opens its API to approved partners. Turn on Garmin's sync to Strava and connect Strava here.",
    feeds: "Runs and workouts through Strava" },
  { id: "apple-health", name: "Apple Watch sleep", rooms: ["bedroom"], method: "phone",
    blurb: "The same Office Shortcut also sends last night's sleep from your Apple Watch. One install covers the Gym and the Bedroom.",
    feeds: "Sleep and sleep stages in the Bedroom" },
  { id: "receipt", name: "Groceries", rooms: ["kitchen"], method: "upload",
    blurb: "Online orders and e-receipts arrive through Google by themselves. In a shop, snap the paper receipt and Claude fills the fridge.",
    feeds: "Pantry and spending in the Kitchen" },
  { id: "calendar", name: "Apple or Outlook calendar", rooms: ["office"], method: "paste",
    blurb: "Apple and Outlook have no login for websites, so you share a private calendar link once. It refreshes on every visit.",
    feeds: "Your week in the Office" },
  { id: "email-forward", name: "Other email addresses", rooms: ["office"], method: "guide",
    blurb: "School, work, Outlook or iCloud mail? Forward it to the Gmail you connected and Claude reads it with the rest.",
    feeds: "To-dos and plans from every inbox" },
];

export const byId = (id: string) => CONNECTORS.find((c) => c.id === id);
