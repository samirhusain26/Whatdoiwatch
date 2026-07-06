// Phase 2.5 — generic response cache over the server DB's `api_cache` table.
// Used by lib/tmdb.ts (genres 24h, title detail/videos/providers 7 days) and
// lib/watchmode.ts (IMDb rating 7 days) to keep Watchmode's 1,000 req/month
// cap and TMDB rate limits far out of reach for repeat lookups.

import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { apiCache } from "@/lib/db/schema";

export const TTL = {
  GENRES: 24 * 60 * 60 * 1000,
  DETAIL: 7 * 24 * 60 * 60 * 1000,
  IMDB_RATING: 7 * 24 * 60 * 60 * 1000,
} as const;

// Wrapped in { v: T } so a legitimately-cached `null`/`undefined` value (e.g.
// "this title has no Watchmode match") is distinguishable from "no cache row".
// Without the wrapper, caching a null result would look identical to a cache
// miss and get re-fetched every time — defeating the point of caching exactly
// the lookups that are cheapest to skip.
async function getCached<T>(key: string): Promise<{ hit: true; value: T } | { hit: false }> {
  const rows = await db.select().from(apiCache).where(eq(apiCache.key, key));
  const row = rows[0];
  if (!row || row.expiresAt < Date.now()) return { hit: false };
  return { hit: true, value: (row.payload as { v: T }).v };
}

async function setCached<T>(key: string, value: T, ttlMs: number): Promise<void> {
  const expiresAt = Date.now() + ttlMs;
  const payload = { v: value };
  await db
    .insert(apiCache)
    .values({ key, payload, expiresAt })
    .onConflictDoUpdate({ target: apiCache.key, set: { payload, expiresAt } });
}

/** Cache-aside helper: returns the cached value if fresh, otherwise calls
 *  `fetcher`, caches the result, and returns it. Fetch errors propagate
 *  uncached (never cache a failure). */
export async function withCache<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const cached = await getCached<T>(key);
  if (cached.hit) return cached.value;
  const fresh = await fetcher();
  await setCached(key, fresh, ttlMs);
  return fresh;
}
