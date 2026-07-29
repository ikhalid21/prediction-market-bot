# Gridiron Lab — Fantasy Football Analytics

An interactive fantasy football app built on real NFL data: player stats and
trends, schedule difficulty, mock drafts, player comparisons, and historical
season data.

## Features

- **Players** — search and filter every fantasy-relevant player back to 2010,
  with career stat lines and weekly trend charts (2018+).
- **Compare** — put up to 4 players side by side across their entire
  careers: a career radar profile, career totals, and a season-by-season
  breakdown with an auto-generated insight for every year.
- **Schedule Difficulty** — 2026 rest-of-season strength of schedule by
  position, computed from how many fantasy points each defense actually
  allowed in 2025.
- **Mock Draft** — a 10 or 12-team snake draft against CPU opponents, ranked
  Half-PPR (0.5 pt/reception) Top-300 from real 2025 season production, with
  a full live draft board (every pick, every team) and a post-draft grade.
- **Historical Seasons** — league leaders at every position (including team
  D/ST), season by season from 2010–2025.

Scoring format (Standard / Half-PPR / PPR) is a global toggle in the header.

## Data

All stats come from [nflverse](https://github.com/nflverse/nflverse-data), an
open, public NFL play-by-play data project — not synthetic or fabricated
data. `scripts/process.py` downloads season/weekly player stats and game
schedules and turns them into the static JSON files consumed by the app
(`public/data/`). Team defense (D/ST) scoring and schedule-difficulty ratings
are derived from those same box scores using standard fantasy scoring rules.

Mock draft rankings are seeded from final 2025 season fantasy production,
scored Half-PPR — they are **not** a live industry ADP feed or a licensed
third-party rankings feed (e.g. CBS Sports). Within QB/RB/WR/TE, players are
ordered by Value-Based Drafting (points above a per-position replacement
baseline), not raw points — this is why elite QBs, who out-score everyone on
raw points but are easy to replace off the waiver wire, don't go in round 1,
matching how real half-PPR single-QB drafts actually play out.

## Development

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check + production build
```

To regenerate `public/data/`, see `scripts/process.py` (requires `pandas`).
