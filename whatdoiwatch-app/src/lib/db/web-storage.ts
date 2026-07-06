// localStorage-backed fallback for the client DB on web (see device-client.ts
// for why: expo-sqlite's web/OPFS backend needs SharedArrayBuffer, which the
// Expo dev server doesn't expose). Mirrors the exact function signatures and
// row shapes of watchlist-queries.ts/prefs-queries.ts so those files can
// branch on `Platform.OS === 'web'` and call through here without callers
// (index.tsx, watchlist.tsx, title detail) needing to know the difference.
//
// Simple read-modify-write over a couple of flat JSON blobs — plenty for a
// local, single-user, low-hundreds-of-rows watchlist.

import type { MediaItem, MediaType, Seed } from "@/lib/media";
import type { WatchlistRow, WatchlistStatus } from "@/lib/db/watchlist-queries";

const WATCHLIST_KEY = "wdw_watchlist";
const PREFS_KEY = "wdw_prefs";

function hasLocalStorage(): boolean {
  return typeof localStorage !== "undefined";
}

function readWatchlist(): WatchlistRow[] {
  if (!hasLocalStorage()) return [];
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    return raw ? (JSON.parse(raw) as WatchlistRow[]) : [];
  } catch {
    return [];
  }
}

function writeWatchlist(rows: WatchlistRow[]): void {
  if (!hasLocalStorage()) return;
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(rows));
}

function readPrefs(): Record<string, unknown> {
  if (!hasLocalStorage()) return {};
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function writePrefs(prefs: Record<string, unknown>): void {
  if (!hasLocalStorage()) return;
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export const webWatchlist = {
  add(item: Pick<MediaItem, "media_type" | "id" | "title" | "poster">, status: WatchlistStatus): void {
    const rows = readWatchlist().filter((r) => !(r.mediaType === item.media_type && r.titleId === item.id));
    rows.push({
      mediaType: item.media_type,
      titleId: item.id,
      status,
      addedAt: Date.now(),
      title: item.title,
      posterPath: item.poster,
    });
    writeWatchlist(rows);
  },

  updateStatus(mediaType: MediaType, titleId: number, status: WatchlistStatus): void {
    const rows = readWatchlist();
    const row = rows.find((r) => r.mediaType === mediaType && r.titleId === titleId);
    if (row) row.status = status;
    writeWatchlist(rows);
  },

  remove(mediaType: MediaType, titleId: number): void {
    writeWatchlist(readWatchlist().filter((r) => !(r.mediaType === mediaType && r.titleId === titleId)));
  },

  getAll(status?: WatchlistStatus): WatchlistRow[] {
    const rows = readWatchlist();
    return rows
      .filter((r) => !status || r.status === status)
      .sort((a, b) => b.addedAt - a.addedAt);
  },

  getStatus(mediaType: MediaType, titleId: number): WatchlistStatus | null {
    const row = readWatchlist().find((r) => r.mediaType === mediaType && r.titleId === titleId);
    return row?.status ?? null;
  },

  getExcludeList(): Seed[] {
    return readWatchlist()
      .filter((r) => r.status === "seen" || r.status === "not_interested")
      .map((r) => ({ media_type: r.mediaType, id: r.titleId }));
  },

  getSeenIds(): Seed[] {
    return readWatchlist()
      .filter((r) => r.status === "seen")
      .map((r) => ({ media_type: r.mediaType, id: r.titleId }));
  },
};

export const webPrefs = {
  get<T>(key: string, fallback: T): T {
    const prefs = readPrefs();
    return key in prefs ? (prefs[key] as T) : fallback;
  },

  set<T>(key: string, value: T): void {
    const prefs = readPrefs();
    prefs[key] = value;
    writePrefs(prefs);
  },
};
