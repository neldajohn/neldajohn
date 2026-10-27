# Solve Practice Simulator (unofficial)

A personal, single-player practice replica of the McKinsey Solve assessment (2026 format), rebuilt from public candidate reports. **Not affiliated with or endorsed by McKinsey & Company.** All scenarios are original and procedurally generated; timings and scoring are a practice model (see `REPORTED_FACTS.md`).

## Run it

```bash
cd solve-sim
npm install
npm run dev      # http://localhost:5173 — desktop browser, ≥1024px wide
npm test         # Vitest: generators + scorers
npm run build    # type-check + production build
```

## What's inside

- **Sittings:** 65 / 95 minutes (95 is the default) or single-game practice. Each game has its own clock and an untimed tutorial. There's no going back to an earlier game, and closing the tab abandons the attempt.
- **Red Rock Study:** drag values from the study into a Research Journal, answer questions with an on-screen calculator that keeps a history, fill a one-way report and lock a chart type, then work through six sequential cases.
- **Sea Wolf:** three sites. For each: lock two characteristics, sort the queue, build the prospect pool, pick the final three. The generator mixes sites where 100% is reachable with sites where it isn't, and the debrief shows the best possible score for every site.
- **Sustainable Futures Lab:** opening question ranking, then three days of Explore → Assign → Support → Reflect with four researchers (ecologist, biologist, habitat planner, engineer) and four stations. Placements and notes carry over; support problems arrive together with deadlines; learning mode adds a review after each stage in single-game practice.
- **Ecosystem Building (legacy):** behind a toggle in Settings.
- **Drills** (home page): 10 untimed tries on one skill with instant feedback — Sea Wolf sorting, locking, keep-one-of-three and final treatment; Red Rock data spotting, analysis maths and cases; Sustainable Futures Lab explore, assignment reasons, support replies, support order and reflect ratings.
- **Debrief:** a practice score for each game (product + process), a timeline of where your time went, what you missed, the optimal answers and one habit to fix. Replay any run from its seed via History.

## Layout

```
src/config.ts            all timings, counts, weights
src/store/sitting.ts     sitting flow, clocks, telemetry, persistence
src/games/<game>/        generator (seeded), scorer, UI, tests
src/pages/               home, sitting host, end screens, debrief, history
```

Every interaction is logged as `{t_ms, game, phase, type, payload}` to drive process scores and the debrief.
