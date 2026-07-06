// Watchmode client — IMDb rating lookup only (per locked decision, streaming
// sources now come from TMDB watch/providers instead). Server-only: reads
// process.env.WATCHMODE_API_KEY directly.
//
// Cached 7 days via the persistent api_cache table (Phase 2.5) — this keeps
// Watchmode's 1,000 req/month cap far out of reach since it's only ever
// called from the detail endpoint, hard-cached per title.
//
// Degrades gracefully: any error or quota exhaustion returns null so the
// detail endpoint can fall back to TMDB's vote_average.

import { TTL, withCache } from "@/lib/api-cache";
import type { MediaType } from "@/lib/media";

const WATCHMODE_BASE = "https://api.watchmode.com/v1";

function cacheKey(mediaType: MediaType, tmdbId: number): string {
  return `watchmode:imdb:${mediaType}:${tmdbId}`;
}

interface WatchmodeSearchResult {
  id: number;
}

interface WatchmodeSearchResponse {
  title_results?: WatchmodeSearchResult[];
}

interface WatchmodeDetailsResponse {
  imdb_rating?: number | null;
}

async function fetchImdbRatingFromWatchmode(mediaType: MediaType, tmdbId: number): Promise<number | null> {
  const apiKey = process.env.WATCHMODE_API_KEY;
  if (!apiKey) return null;

  // Watchmode's search-by-tmdb_id endpoint distinguishes movie vs tv shows.
  const searchType = mediaType === "movie" ? "movie" : "tv_series";

  const searchUrl = new URL(`${WATCHMODE_BASE}/search/`);
  searchUrl.searchParams.set("apiKey", apiKey);
  searchUrl.searchParams.set("search_field", "tmdb_id");
  searchUrl.searchParams.set("search_value", String(tmdbId));
  searchUrl.searchParams.set("search_type", searchType);

  const searchRes = await fetch(searchUrl.toString());
  if (!searchRes.ok) return null;
  const searchData = (await searchRes.json()) as WatchmodeSearchResponse;
  const wmId = searchData.title_results?.[0]?.id;
  if (!wmId) return null;

  const detailsUrl = new URL(`${WATCHMODE_BASE}/title/${wmId}/details/`);
  detailsUrl.searchParams.set("apiKey", apiKey);

  const detailsRes = await fetch(detailsUrl.toString());
  if (!detailsRes.ok) return null;
  const details = (await detailsRes.json()) as WatchmodeDetailsResponse;
  return details.imdb_rating ?? null;
}

export async function getImdbRating(mediaType: MediaType, tmdbId: number): Promise<number | null> {
  try {
    return await withCache(cacheKey(mediaType, tmdbId), TTL.IMDB_RATING, () =>
      fetchImdbRatingFromWatchmode(mediaType, tmdbId),
    );
  } catch {
    // Degrade gracefully — never throw, never leak the API key.
    return null;
  }
}
