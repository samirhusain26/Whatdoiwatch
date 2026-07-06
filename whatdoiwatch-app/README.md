# What Do I Watch — App Developer Guide

This directory holds the Expo universal application (supporting Web, iOS, and Android) built with Expo Router.

---

## 1. Project Documentation

To understand the app's architecture, design language, and database pipeline, consult the main documentation:

*   **Design & UI Guidelines**: [docs/UI.md](../docs/UI.md)
*   **System Architecture & Recommender Flow**: [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
*   **Database Schema & Seeding Pipeline**: [docs/DATABASE.md](../docs/DATABASE.md)
*   **Deployment & Product Backlog**: [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md)

---

## 2. Main Directories

*   **`src/app/`**: File-based router entry points. Handles UI pages (`index`, `swipe`, `group`, `watchlist`, `surprise`) and server API endpoints (`api/`).
*   **`src/components/`**: Shareable UI primitives (`ui.tsx`) and application components like cards, list grids, filters, and embedded trailers.
*   **`src/lib/`**: App state utilities, cache controllers, third-party client fetchers (TMDB, Watchmode), SQLite configurations, and the hybrid recommender algorithm.
*   **`scripts/`**: Offline data scraping and corpus indexing scripts written in Python and TypeScript.
*   **`data/`**: Location of the pre-seeded SQLite database file `app.db` and raw corpus indexes.

---

## 3. Running Locally

Before running, ensure you have populated API keys inside `whatdoiwatch-app/.env` (see the root [README.md](../README.md) for details).

Install dependencies:
```bash
npm install
```

Start the app on your preferred platform:
```bash
npm run web       # Web layout on http://localhost:8081
npm run ios       # iOS Simulator
npm run android   # Android Emulator
```

*Note: All development scripts append the `--clear` flag to bypass Metro bundle caching issues across layout adjustments.*
