// GET /api/surprise?media=&genre=&time=&rating=&region=
// Phase 2.6 — Binge-It-On's "random pick" flow, done right: discover with
// current filters -> random pick from the top ~20 -> full detail card ->
// "10 similar" via the hybrid recommender. Relaxes filters (drop genre, then
// era) and retries if too few results, telling the client when it did.

import { z } from "zod";
import { discoverMovies, discoverTv, getTitleDetail } from "@/lib/tmdb";
import { getImdbRating } from "@/lib/watchmode";
import { getDateRange } from "@/lib/dates";
import { resolveRegion } from "@/lib/region";
import { getHybridRecommendations } from "@/lib/recommender";
import type { Era, MediaItem, SurpriseResponse } from "@/lib/media";

const ERAS = ["this_month", "this_year", "this_decade", "last_decade", "this_century", "old", "ancient", ""] as const;

const querySchema = z.object({
  media: z.enum(["movie", "tv", "all"]).default("all"),
  genre: z.string().trim().optional(),
  time: z.enum(ERAS).optional().default(""),
  rating: z.coerce.number().min(0).max(10).optional(),
  region: z.string().trim().optional(),
});

const MIN_POOL_SIZE = 5;
const POOL_TOP_N = 20;

async function discoverPool(
  media: "movie" | "tv" | "all",
  genre: string | undefined,
  time: Era,
  rating: number | undefined,
): Promise<MediaItem[]> {
  const { gte, lte } = getDateRange(time);
  const filters = { genre, dateGte: gte, dateLte: lte, minRating: rating };
  if (media === "movie") return discoverMovies(filters);
  if (media === "tv") return discoverTv(filters);
  const [movies, tv] = await Promise.all([discoverMovies(filters), discoverTv(filters)]);
  const merged: MediaItem[] = [];
  const max = Math.max(movies.length, tv.length);
  for (let i = 0; i < max; i++) {
    if (i < movies.length) merged.push(movies[i]);
    if (i < tv.length) merged.push(tv[i]);
  }
  return merged;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    media: url.searchParams.get("media") ?? undefined,
    genre: url.searchParams.get("genre") ?? undefined,
    time: (url.searchParams.get("time") as Era | null) ?? undefined,
    rating: url.searchParams.get("rating") ?? undefined,
    region: url.searchParams.get("region") ?? undefined,
  });

  if (!parsed.success) {
    return Response.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const { media, genre, time, rating, region } = parsed.data;

  try {
    let pool = await discoverPool(media, genre, time as Era, rating);
    let relaxed = false;
    let relaxedNote: string | undefined;

    if (pool.length < MIN_POOL_SIZE && genre) {
      pool = await discoverPool(media, undefined, time as Era, rating);
      relaxed = true;
      relaxedNote = "Removed the genre filter";
    }
    if (pool.length < MIN_POOL_SIZE && time) {
      pool = await discoverPool(media, relaxed ? undefined : genre, "" as Era, rating);
      relaxed = true;
      relaxedNote = relaxedNote ? `${relaxedNote} and time window` : "Removed the time window filter";
    }

    if (pool.length === 0) {
      const body: SurpriseResponse = { picked: null, similar: [], relaxed, relaxedNote };
      return Response.json(body);
    }

    const top = pool.slice(0, Math.min(POOL_TOP_N, pool.length));
    const chosen = top[Math.floor(Math.random() * top.length)];
    const resolvedRegion = resolveRegion(region ?? null);

    const [detail, imdbRating, hybrid] = await Promise.all([
      getTitleDetail(chosen.media_type, chosen.id, resolvedRegion),
      getImdbRating(chosen.media_type, chosen.id),
      getHybridRecommendations({
        seeds: [{ media_type: chosen.media_type, id: chosen.id }],
        media,
        excludeKeys: new Set([`${chosen.media_type}:${chosen.id}`]),
        time: "" as Era,
        limit: 10,
      }),
    ]);

    const picked = { ...detail, imdb_rating: imdbRating ?? detail.vote_average ?? null };
    const body: SurpriseResponse = { picked, similar: hybrid.results, relaxed, relaxedNote };
    return Response.json(body);
  } catch (error) {
    console.error("GET /api/surprise failed:", error);
    return Response.json({ error: "Failed to fetch a surprise pick" }, { status: 500 });
  }
}
