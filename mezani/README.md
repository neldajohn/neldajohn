# Mezani 🍽️

**Mezani** ("at the table" in Swahili) is an OpenTable-style restaurant
reservation app built for Tanzania, entirely in Swahili.

## Features

- Search mikahawa (restaurants) by jiji (city), tarehe (date), saa (time),
  and idadi ya watu (party size)
- Browse and filter by city and aina ya chakula (cuisine)
- Restaurant pages with menu highlights, hours, address, and live time-slot
  availability
- Book a table with a simple contact form — no account required
- Instant confirmation page with a reservation code

Seed data covers restaurants across Dar es Salaam, Arusha, Zanzibar, Mwanza,
Dodoma, and Moshi.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- better-sqlite3 for restaurant and reservation storage
- Server Actions for the booking flow

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). A local SQLite database
is created at `data/mezani.db` on first run and seeded automatically.
