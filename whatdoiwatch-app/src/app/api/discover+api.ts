// GET /api/discover?media=&genre=&time=&rating=
// media = movie|tv|all. "all" queries both discover endpoints in parallel and
// interleaves results (both lists already come back sorted by
// popularity.desc from TMDB, so a round-robin merge preserves that ordering).

import { z } from "zod";
import { discoverMovies, discoverTv } from "@/lib/tmdb";
import { getDateRange } from "@/lib/dates";
import type { DiscoverResponse, Era, MediaItem } from "@/lib/media";

const ERAS = ["this_month", "this_year", "this_decade", "last_decade", "this_century", "old", "ancient", ""] as const;

const querySchema = z.object({
  media: z.enum(["movie", "tv", "all"]).default("all"),
  genre: z.string().trim().optional(),
  time: z.enum(ERAS).optional().default(""),
  rating: z.coerce.number().min(0).max(10).optional(),
});

function interleave(a: MediaItem[], b: MediaItem[]): MediaItem[] {
  const merged: MediaItem[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (i < a.length) merged.push(a[i]);
    if (i < b.length) merged.push(b[i]);
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
  });

  if (!parsed.success) {
    return Response.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const { media, genre, time, rating } = parsed.data;
  const { gte, lte } = getDateRange(time as Era);
  const filters = { genre, dateGte: gte, dateLte: lte, minRating: rating };

  try {
    let results: MediaItem[];

    if (media === "movie") {
      results = await discoverMovies(filters);
    } else if (media === "tv") {
      results = await discoverTv(filters);
    } else {
      const [movies, tv] = await Promise.all([discoverMovies(filters), discoverTv(filters)]);
      results = interleave(movies, tv);
    }

    const body: DiscoverResponse = { results };
    return Response.json(body);
  } catch (error) {
    console.error("GET /api/discover failed:", error);
    return Response.json({ error: "Failed to discover titles" }, { status: 500 });
  }
}
