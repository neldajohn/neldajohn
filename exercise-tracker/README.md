# 🩷 Nelda's Strength Tracker

A custom pink &amp; grey exercise tracker built from Nelda's real training log
(`Mazoezi.xlsx`) — every week, day, exercise, planned target and logged set from
the original spreadsheet is preloaded, so it opens with real history instead of
an empty app.

## Features

- **Dashboard** — weekly training volume chart, lifetime stats (weeks tracked,
  workouts completed, sets logged, total volume), and a feed of recently
  logged sets.
- **Weeks** — browse every training week, drill into a week to see each day
  (Upper/Lower/Push/Pull/etc.), planned vs. logged sets, cardio, and notes.
  Everything is editable inline: add/edit/delete sets, exercises, days, weeks.
- **Exercise Progress** — pick any exercise from a searchable dropdown
  (seeded from the spreadsheet's exercise list, grouped by muscle group) to
  see a load / estimated-1RM chart, personal records (best load, best est.
  1RM, most reps, biggest session volume), and full session history.
- **Log Workout** — a fast entry flow for logging a full session: pick a
  week/day (or create a new one), add exercises via the same searchable
  picker, and add as many sets as needed per exercise.
- **Settings** — export your data as a JSON backup, import a backup, or reset
  back to the original imported program.

Everything is pink & grey, mobile-friendly, and stores data in the browser's
`localStorage` (no backend/database needed) — a JSON export/import is
provided for backups and moving between devices.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploying to Vercel

1. Push this repo (or this `exercise-tracker` folder) to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. If the app lives in a subfolder (as it does here, inside a personal
   GitHub-profile repo), set the Vercel project's **Root Directory** to
   `exercise-tracker`.
4. No environment variables or database are required — click **Deploy**.

## Tech stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 for styling
- Recharts for the progress charts
- Data persistence via `localStorage` (see `src/context/WorkoutContext.tsx`)

## Data source

The original spreadsheet's first sheet ("Weights Log & Program") was parsed
into `src/data/seedData.json`, and its exercise list (Sheet7) into
`src/data/exerciseCatalog.json`. These seed the app on first load; anything
you add afterwards lives in your browser's `localStorage`.
