# iPhone Shortcut: Log workout

Sends a gym note (see [gym-template.md](gym-template.md)) to the dashboard. It needs the site to be online (the Vercel URL) and the `INGEST_TOKEN` value.

## Build it once

In the Shortcuts app, tap **+** and name it **Log workout**.

1. Tap the **i** (details) button. Turn on **Show in Share Sheet**. Under share sheet types, keep only **Text** (Notes shares as text).
2. Add **Get Contents of URL**:
   - URL: `https://YOUR-SITE.vercel.app/api/ingest/workout-text`
   - Method: **POST**
   - Headers: `Authorization` = `Bearer YOUR_INGEST_TOKEN`
   - Request Body: **JSON**, one field: key `text`, type Text, value **Shortcut Input**.
3. Add **Get Dictionary Value**: key `message`, from **Contents of URL**.
4. Add **Show Result** (or **Show Notification**) with the **Dictionary Value**.

## Use it

Open the routine note, tap Share, then **Log workout**. You'll see something like:

```
Saved 3 sessions. Latest: Push on Oct 17, 4 exercises, 11 sets.
Couldn't read: 37.5 x is 11
```

If a line couldn't be read, fix it in the note and share again. Sending again only updates the same sessions.

## Test from the Mac

```bash
curl -X POST http://localhost:3000/api/ingest/workout-text \
  -H "Authorization: Bearer $INGEST_TOKEN" -H "Content-Type: application/json" \
  -d '{"text":"Push\nSat 17 Oct\nFlat DB press\n50 x 8\n50 x 8"}'
```
