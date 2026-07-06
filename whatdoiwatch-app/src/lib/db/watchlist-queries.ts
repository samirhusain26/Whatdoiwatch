// Typed query layer over the on-device watchlist table (client-schema.ts +
// device-client.ts). All user watchlist writes/reads go through here so
// app/watchlist.tsx and the detail screens don't touch drizzle directly.
//
// Branches on Platform.OS: native uses the real expo-sqlite-backed
// deviceDb; web uses a localStorage fallback (web-storage.ts) since
// expo-sqlite's web/OPFS backend needs SharedArrayBuffer, unavailable in the
// Expo dev server — see device-client.ts for the full explanation.

import { Platform } from "react-native";
import { and, eq, inArray } from "drizzle-orm";

import { deviceDb } from "@/lib/db/device-client";
import { watchlist } from "@/lib/db/client-schema";
import { webWatchlist } from "@/lib/db/web-storage";
import type { MediaItem, MediaType, Seed } from "@/lib/media";

export type WatchlistStatus = "want_to_watch" | "seen" | "not_interested";

export interface WatchlistRow {
  mediaType: MediaType;
  titleId: number;
  status: WatchlistStatus;
  addedAt: number;
  title: string;
  posterPath: string | null;
}

const isWeb = Platform.OS === "web";

/** Adds (or overwrites) a watchlist entry for a title with the given status.
 *  Title + poster are denormalized from the MediaItem so the tab can render
 *  offline without hitting the API. */
export async function addToWatchlist(
  item: Pick<MediaItem, "media_type" | "id" | "title" | "poster">,
  status: WatchlistStatus
): Promise<void> {
  if (isWeb) return webWatchlist.add(item, status);
  await deviceDb
    .insert(watchlist)
    .values({
      mediaType: item.media_type,
      titleId: item.id,
      status,
      addedAt: Date.now(),
      title: item.title,
      posterPath: item.poster,
    })
    .onConflictDoUpdate({
      target: [watchlist.mediaType, watchlist.titleId],
      set: { status, addedAt: Date.now(), title: item.title, posterPath: item.poster },
    });
}

/** Updates just the status of an existing watchlist row. If the row doesn't
 *  exist yet, callers should use addToWatchlist instead (needs title/poster). */
export async function updateStatus(
  mediaType: MediaType,
  titleId: number,
  status: WatchlistStatus
): Promise<void> {
  if (isWeb) return webWatchlist.updateStatus(mediaType, titleId, status);
  await deviceDb
    .update(watchlist)
    .set({ status })
    .where(and(eq(watchlist.mediaType, mediaType), eq(watchlist.titleId, titleId)));
}

export async function removeFromWatchlist(mediaType: MediaType, titleId: number): Promise<void> {
  if (isWeb) return webWatchlist.remove(mediaType, titleId);
  await deviceDb
    .delete(watchlist)
    .where(and(eq(watchlist.mediaType, mediaType), eq(watchlist.titleId, titleId)));
}

/** Returns watchlist rows, optionally filtered to a single status. */
export async function getWatchlist(status?: WatchlistStatus): Promise<WatchlistRow[]> {
  if (isWeb) return webWatchlist.getAll(status);

  const rows = status
    ? await deviceDb.select().from(watchlist).where(eq(watchlist.status, status))
    : await deviceDb.select().from(watchlist);

  return rows
    .map((r) => ({
      mediaType: r.mediaType as MediaType,
      titleId: r.titleId,
      status: r.status as WatchlistStatus,
      addedAt: r.addedAt,
      title: r.title,
      posterPath: r.posterPath,
    }))
    .sort((a, b) => b.addedAt - a.addedAt);
}

/** Looks up the status of a single title, if it's in the watchlist at all. */
export async function getStatus(
  mediaType: MediaType,
  titleId: number
): Promise<WatchlistStatus | null> {
  if (isWeb) return webWatchlist.getStatus(mediaType, titleId);
  const rows = await deviceDb
    .select({ status: watchlist.status })
    .from(watchlist)
    .where(and(eq(watchlist.mediaType, mediaType), eq(watchlist.titleId, titleId)));
  return (rows[0]?.status as WatchlistStatus | undefined) ?? null;
}

/** All seen + not_interested ids, shaped as Seed[] for the /api/recommendations
 *  `exclude=` param (so dismissed/seen titles never reappear). */
export async function getExcludeList(): Promise<Seed[]> {
  if (isWeb) return webWatchlist.getExcludeList();
  const rows = await deviceDb
    .select({ mediaType: watchlist.mediaType, titleId: watchlist.titleId })
    .from(watchlist)
    .where(inArray(watchlist.status, ["seen", "not_interested"]));
  return rows.map((r) => ({ media_type: r.mediaType as MediaType, id: r.titleId }));
}

/** Ids marked "seen" only — for the (currently unimplemented) 0.5x implicit
 *  seed logic; see IMPLEMENTATION_PLAN.md 3.3 and the final report gap note. */
export async function getSeenIds(): Promise<Seed[]> {
  if (isWeb) return webWatchlist.getSeenIds();
  const rows = await deviceDb
    .select({ mediaType: watchlist.mediaType, titleId: watchlist.titleId })
    .from(watchlist)
    .where(eq(watchlist.status, "seen"));
  return rows.map((r) => ({ media_type: r.mediaType as MediaType, id: r.titleId }));
}
