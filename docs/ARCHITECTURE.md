# System Architecture & Technical Documentation

This document describes the runtime architecture, code organization, client-server separation, API routes, and recommendation flow for the **What Do I Watch** application.

---

## 1. Directory Structure

The codebase is organized as a unified Expo universal project located in the `whatdoiwatch-app/` subdirectory:

*   **`whatdoiwatch-app/src/app/`**: Application routing and server endpoints.
    *   **`(tabs)/`**: The primary tab screens (Home, Surprise, Swipe, Movie Night, Watchlist).
    *   **`api/`**: Expo Router API routes (Server-side Node.js endpoints).
    *   **`title/[type]/[id].tsx`**: Title detail modal.
    *   **`_layout.tsx`**: Root configuration (QueryClient, theme setup, font loading).
*   **`whatdoiwatch-app/src/components/`**: Shared visual widgets (cards, grids, filters, trailers).
*   **`whatdoiwatch-app/src/lib/`**: Business logic, API clients, and database queries.
    *   **`db/`**: Client-side database interface, Web storage fallback, server database definitions.
    *   **`recommender.ts`**: The core hybrid recommendation algorithm.
*   **`whatdoiwatch-app/scripts/`**: Offline data pipelines (Python scraper/builder, SQLite seeder).
*   **`whatdoiwatch-app/data/`**: Runtime databases (`app.db` server data) and ML source files.

---

## 2. Client vs. Server Boundaries

To allow the application to compile for native platforms (iOS/Android) and web, a strict compilation and runtime boundary is maintained:

```
┌──────────────────────────────────────┐          ┌──────────────────────────────────────┐
│            CLIENT / APP              │          │            SERVER / API              │
│       (Runs on Native & Web)         │          │         (Runs on Node.js)            │
├──────────────────────────────────────┤          ├──────────────────────────────────────┤
│ • React Native UI & Components       │          │ • Expo API Routes (src/app/api/*)    │
│ • Local DB: sqlite (native) /        │  HTTP    │ • Server DB: Node sqlite (app.db)    │
│   localStorage (web fallback)        │ ───────> │ • TMDB / Watchmode live fetchers     │
│ • State: TanStack React Query        │ <─────── │ • Precomputed Cosine Similarity      │
│ • Theme & styles (NativeWind / CSS)  │          │   neighbor lookup                    │
└──────────────────────────────────────┘          └──────────────────────────────────────┘
```

*   **Client Code**:
    *   Runs in native JS environments or browser.
    *   Uses `expo-sqlite` and `drizzle-orm` for on-device watchlists and preferences.
    *   On the web, `expo-sqlite` fails due to sandboxing/SharedArrayBuffer restrictions in Expo's dev Metro server. The app fallbacks automatically to `localStorage` (via `src/lib/db/web-storage.ts`).
    *   *Must never import from server libraries (like `node:sqlite`).*
*   **Server Code**:
    *   Runs exclusively in a Node.js runtime environment (e.g. server-side functions).
    *   Queries `whatdoiwatch-app/data/app.db` which contains ~16k pre-populated TMDB titles and precalculated ML relationships.
    *   Can freely access environment variables (like `TMDB_API_KEY`) which are never exposed to client bundles.

---

## 3. The Recommendation Engine (`src/lib/recommender.ts`)

The app uses a hybrid recommendation engine that blends precomputed offline local features with live real-time API results from TMDB.

### Algorithm Details
For a list of seed titles (selected liked titles), the hybrid engine executes the following:

1.  **Local Similarity Score (60% weight)**:
    *   Queries the `similar_titles` table in `app.db` for each seed.
    *   Collects precomputed nearest neighbor candidates and their cosine similarity score (ranging from 0.0 to 1.0).
2.  **Live Recommendations (40% weight)**:
    *   Calls the live `/recommendations` TMDB endpoint for each seed.
    *   Converts the rank position in TMDB's response into a normalized score ($1 - \text{rank}/\text{total}$).
3.  **Combination & Boosting**:
    *   Scores from both sources are blended:
        $$\text{Score} = 0.6 \times \text{Local Score} + 0.4 \times \text{Live Score}$$
    *   **Intersection Boost**: If a candidate title is returned by both the local dataset *and* TMDB live recommendations, its score receives a $+0.15$ boost.
    *   **Additive Seed Scaling**: Scores are accumulated across all provided seeds. Candidates that align with multiple seeds naturally bubble to the top, forming the consensus in Movie Night.
4.  **Exclusions**:
    *   Always filters out the active seed titles.
    *   Excludes titles already marked "seen" or "not_interested" on the device.
5.  **Cross-Type Balance**:
    *   In "all" media type mode (both movies and TV), if the seed list is dominated by one type (e.g. only movie seeds), the engine limits the ratio of cross-type recommendations (e.g., TV recommendations) to $30\%$ of results to preserve relevance, while still allowing surprise recommendations to flow.
6.  **Details Hydration**:
    *   Since local DB similarity seeds do not store full image/overview metadata, the engine fetches details (poster, description) from TMDB dynamically for the top $N$ titles *after* filtering. This avoids unnecessary network calls.

---

## 4. API Endpoints (`src/app/api/`)

All requests from the app frontend route through the local server:

*   `/api/discover`: Handles primary filtering by media type, genre, release era, and rating. Leverages both TMDB discovery and local dataset matching.
*   `/api/genres`: Fetches localized lists of genre types and IDs.
*   `/api/search`: Handles incremental auto-complete queries of TMDB and maps titles.
*   `/api/surprise`: Returns random titles from the local corpus that match rating/genre/era filters.
*   `/api/recommendations`: Executes the hybrid recommender by passing a list of seed ids and user filter settings.

---

## 5. Third-Party Integrations

*   **TMDB API**: Used for search autocomplete, live recommendation fallbacks, trailer video keys, watch providers, and posters.
*   **Watchmode API**: Utilized to fetch accurate IMDb/critic ratings for detail sheets. To safeguard Watchmode's 1000-request-per-month free tier, results are cached on the server for **7 days** inside the SQLite `api_cache` table.
