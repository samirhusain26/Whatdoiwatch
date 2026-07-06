// On-device client DB schema (Phase 3: watchlist/feedback). All user-writable
// data lives here — the server DB stays read-only/stateless. Queried from app
// components via drizzle-orm/expo-sqlite (device-client.ts), never from API
// routes.

import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

/** One row per title a user has acted on (want to watch / seen / dismissed).
 *  Title + poster are denormalized here (not just an id) so the watchlist
 *  tab can render fully offline without hitting any API route. */
export const watchlist = sqliteTable(
  "watchlist",
  {
    mediaType: text("media_type").notNull(), // 'movie' | 'tv'
    titleId: integer("title_id").notNull(), // TMDB id
    status: text("status").notNull().$type<"want_to_watch" | "seen" | "not_interested">(),
    addedAt: integer("added_at").notNull(), // unix ms
    title: text("title").notNull(),
    posterPath: text("poster_path"),
  },
  (table) => [primaryKey({ columns: [table.mediaType, table.titleId] })],
);

/** Freeform key/value store: last-used filters, liked-title list, device id,
 *  anything else that should survive restarts without its own table. */
export const prefs = sqliteTable("prefs", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }),
});
