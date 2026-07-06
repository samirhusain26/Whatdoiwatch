// Server DB schema (read-only in production, seeded at build time from the
// ML pipeline — see scripts/seed.ts). Lives at whatdoiwatch-app/data/app.db,
// queried from Expo API routes via drizzle-orm/node-sqlite (Node runtime
// only — never import this from client/native code).
//
// Row shape for `titles` is intentionally close to lib/media.ts's MediaItem
// so API routes can map a row -> MediaItem with minimal glue:
//   { id, media_type, title, year: String(year), poster: poster_path,
//     overview, vote_average, genre_ids: JSON.parse(genres) }

import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

/** 'movie' | 'tv' — stored as plain text, validated at the app boundary via
 *  lib/media.ts's MediaType rather than a SQLite CHECK constraint. */
export const titles = sqliteTable(
  "titles",
  {
    mediaType: text("media_type").notNull(), // 'movie' | 'tv'
    id: integer("id").notNull(), // TMDB id
    title: text("title").notNull(),
    year: integer("year"), // release/first-air year, nullable (unreleased/unknown)
    genres: text("genres", { mode: "json" }).$type<number[]>().notNull(), // TMDB genre ids
    voteAverage: real("vote_average"),
    posterPath: text("poster_path"),
    overview: text("overview"),
  },
  (table) => [
    primaryKey({ columns: [table.mediaType, table.id] }),
  ],
);

/** Precomputed nearest-neighbor table from scripts/export_neighbors.py
 *  (cosine similarity over the genres+keywords+cast+director soup).
 *  Indexed on (src_type, src_id) for fast "similar titles" lookups —
 *  the plan estimates ~500k rows at full corpus scale (~25k titles x 20). */
export const similarTitles = sqliteTable(
  "similar_titles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    srcType: text("src_type").notNull(), // 'movie' | 'tv'
    srcId: integer("src_id").notNull(),
    dstType: text("dst_type").notNull(), // 'movie' | 'tv'
    dstId: integer("dst_id").notNull(),
    score: real("score").notNull(),
  },
  (table) => [
    index("similar_titles_src_idx").on(table.srcType, table.srcId),
  ],
);

/** Generic response cache for TMDB/Watchmode calls made from API routes.
 *  Wired up by a later phase (2.5) — this migration just needs the table
 *  to exist; no helper functions live here. */
export const apiCache = sqliteTable("api_cache", {
  key: text("key").primaryKey(),
  payload: text("payload", { mode: "json" }).notNull(),
  expiresAt: integer("expires_at").notNull(), // unix ms
});

// Re-exported so callers can build "now" comparisons without importing `sql`
// directly if they don't need to.
export const nowUnixMs = sql<number>`(unixepoch('now') * 1000)`;
