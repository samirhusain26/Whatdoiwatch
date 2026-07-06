# What Do I Watch

A universal (web + iOS + Android) movie/TV recommendation app built with Expo Router. Pick
filters or search for titles you like, and get a hybrid recommendation blend of a local
content-based ML model (cosine similarity over genres/keywords/cast/director) and TMDB's live
recommendations — for both movies and TV, mixed together. Includes a "Surprise Me" random-pick
flow, an on-device watchlist with seen/not-interested feedback, and streaming-provider info
per region.

The app lives in [`whatdoiwatch-app/`](whatdoiwatch-app/). This root holds the application, the detailed system documentation, the remaining implementation plan, and a backup of the two legacy apps this replaced (Django + React, and Flask) — see [`_legacy_backup/`](_legacy_backup/) below.

## Documentation

For deep-dives into specific aspects of the codebase, see the dedicated documentation files:
*   **User Interface & Design System**: [docs/UI.md](docs/UI.md) — Color tokens, custom primitives, and guidelines.
*   **System Architecture & Flow**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Server-client boundaries and the recommender engine.
*   **Database Schema & ML Pipeline**: [docs/DATABASE.md](docs/DATABASE.md) — DB layouts, offline Python scraper, vectorization, and database seeding.

## Stack

| Layer | Choice |
|---|---|
| Framework | Expo SDK 57 + Expo Router (file-based routing, universal web + native) |
| Language | TypeScript (strict) |
| Backend | Expo API Routes (server code in the same repo, Node.js) |
| Database | SQLite — server DB via `node:sqlite` + Drizzle ORM (read-only, seeded from the ML pipeline); on-device watchlist via `expo-sqlite` + Drizzle (native) / `localStorage` fallback (web) |
| Styling | NativeWind v4 (Tailwind for React Native) |
| Data fetching | TanStack React Query |
| External APIs | TMDB (search, discover, details, videos, watch providers), Watchmode (IMDb rating only) |
| ML | Offline Python scripts (pandas + scikit-learn) — no Python at runtime |

## Setup

```bash
cd whatdoiwatch-app
npm install
```

Create `whatdoiwatch-app/.env` with your API keys (never commit this file):

```
TMDB_API_KEY=your_tmdb_v3_api_key
WATCHMODE_API_KEY=your_watchmode_api_key
```

Get a free TMDB API key at https://www.themoviedb.org/settings/api and a Watchmode key at
https://api.watchmode.com/.

## Running locally

```bash
cd whatdoiwatch-app
npm run web       # web, http://localhost:8081
npm run ios       # iOS simulator (requires Xcode)
npm run android   # Android emulator (requires Android Studio)
```

All three run `expo start --clear` — the `--clear` flag is intentional and load-bearing: Metro's
bundle cache doesn't reliably invalidate across certain resolver/config changes in this project
(see `metro.config.js`), so every dev-server start does a clean rebuild rather than risk serving
a stale bundle.

The server DB (`whatdoiwatch-app/data/app.db`) ships pre-seeded with a full TMDB corpus (~16k
movies + TV titles and their precomputed similarity neighbors) — the app works out of the box
with no extra setup beyond `.env` and `npm install`.

## The dataset pipeline (build → export → seed)

The recommendation engine's local half comes from an offline pipeline that must be rerun
manually to refresh the corpus (see "Corpus refresh" below). It has three steps, all in
`whatdoiwatch-app/scripts/`:

```bash
cd whatdoiwatch-app

# 1. Set up a Python environment for the pipeline scripts (one-time)
python3 -m venv scripts/.venv
scripts/.venv/bin/pip install -r scripts/requirements.txt

# 2. Build the corpus: pages through TMDB /discover, fetches genres/keywords/
#    cast/director per title, writes data/corpus.parquet. Checkpointed to
#    data/checkpoint.jsonl — safe to Ctrl-C and rerun, it resumes.
scripts/.venv/bin/python3 scripts/build_dataset.py --mode full
#   (or --mode test for a quick ~500-title smoke test first)

# 3. Compute nearest-neighbor similarity: one CountVectorizer + cosine_similarity
#    over the whole corpus (movies + TV together, so cross-type recs fall out
#    for free), writes data/neighbors.json + data/titles_meta.json.
scripts/.venv/bin/python3 scripts/export_neighbors.py

# 4. Load it into the server DB (titles + similar_titles tables).
npx tsx scripts/seed.ts
```

### Manual corpus refresh

Per the locked design decision, the corpus is refreshed **manually**, not on a schedule — rerun
the four steps above every few months when recommendations start feeling stale. TMDB's own
`/recommendations` endpoint (blended in live, at 40% weight, alongside the local model's 60%)
covers new releases in the meantime, so staleness degrades gracefully between refreshes.

## Environment variables

| Variable | Used by | Notes |
|---|---|---|
| `TMDB_API_KEY` | API routes, `scripts/build_dataset.py` | Server-only — never bundled to the client (verified via `npx expo export` + grep) |
| `WATCHMODE_API_KEY` | API routes (detail endpoint only) | Free tier caps at 1,000 req/month; cached 7 days in `api_cache`, so real usage stays far under that |

## Deploying (not done in this build)

This build is local-only per its scope — deploying to EAS Hosting (web + API routes) and
submitting to the App Store / Play Store needs accounts only you can provide. Checklist:

- [ ] `eas login`, then `eas deploy` to publish web + API routes to EAS Hosting
- [ ] Set `TMDB_API_KEY` / `WATCHMODE_API_KEY` as EAS Hosting environment secrets (`eas env:create`) — never bundle them
- [ ] Set the `origin` field in `app.json`/`app.config` to the deployed URL so native builds call the hosted API instead of localhost
- [ ] `eas build` for iOS and Android; internal TestFlight track and Play Console closed-testing track (Play requires a testing period with 12+ testers for personal accounts — start this early)
- [ ] Store listing assets: app icon, splash screen, screenshots per platform, listing copy
- [ ] Submit both for review

## `_legacy_backup/`

Contains the two apps this replaced, moved (not deleted) so nothing is lost:
- `watch/`, `whatdoiwatch/`, `manage.py`, `requirements.txt`, `db.sqlite3` — the original Django
  app
- `binge-it-on/` — the original Flask + scikit-learn app (including its own nested `.git/`)
- `package.json` / `package-lock.json` — the old root Babel/JSX build tooling
- `data_pipeline_working_dir/` — the scratch directory the ML pipeline ran in before its scripts
  and output were moved into `whatdoiwatch-app/scripts/` and `whatdoiwatch-app/data/`; keeps the
  raw fetch checkpoint in case the corpus ever needs to be rebuilt without re-paying API rate
  limits
- `root.env` — the original repo-root `.env` (Django `SECRET_KEY`/`DEBUG`/`ALLOWED_HOSTS`, plus
  the TMDB/Watchmode keys, which are now live in `whatdoiwatch-app/.env`)
- `PROJECTS_OVERVIEW.md` — described the two retired apps

## `IMPLEMENTATION_PLAN.md`

The original build spec, now trimmed to just the remaining account-dependent work (deployment
and store submission) — see that file for what's still outstanding.
