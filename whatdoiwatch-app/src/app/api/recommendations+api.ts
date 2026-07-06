// GET /api/recommendations?seeds=&media=&genre=&time=&rating=&exclude=
// Phase 2.4: hybrid local+live recommender (see lib/recommender.ts) when
// seeds are present; falls back to the Phase 1 discover logic when they're
// not (matching the locked "no seeds -> discover fallback" behavior).

import { z } from "zod";
import { discoverMovies, discoverTv, getMovieGenres, getTvGenres, getTitleDetail } from "@/lib/tmdb";
import { getDateRange } from "@/lib/dates";
import { getHybridRecommendations } from "@/lib/recommender";
import {
  parseSeeds,
  type Era,
  type Genre,
  type MediaItem,
  type RecommendationsResponse,
  type Seed,
} from "@/lib/media";

const ERAS = ["this_month", "this_year", "this_decade", "last_decade", "this_century", "old", "ancient", ""] as const;

const querySchema = z.object({
  seeds: z.string().trim().optional().default(""),
  media: z.enum(["movie", "tv", "all"]).default("all"),
  genre: z.string().trim().optional(),
  time: z.enum(ERAS).optional().default(""),
  rating: z.coerce.number().min(0).max(10).optional(),
  exclude: z.string().trim().optional().default(""),
});

const timeLabels: Record<Exclude<Era, "">, string> = {
  this_month: "this month",
  this_year: "this year",
  this_decade: "this decade",
  last_decade: "last decade",
  this_century: "this century",
  old: "the 1980s-1990s",
  ancient: "before 1980",
};

function seedKey(s: Seed): string {
  return `${s.media_type}:${s.id}`;
}

async function buildDescription(
  media: "movie" | "tv" | "all",
  genre: string | undefined,
  time: Era,
  seeds: Seed[],
  seedTitles: string[]
): Promise<string> {
  let genreName: string | null = null;
  if (genre) {
    const genreId = Number(genre);
    const [movieGenres, tvGenres] = await Promise.all([getMovieGenres(), getTvGenres()]);
    const all: Genre[] = [...movieGenres, ...tvGenres];
    genreName = all.find((g) => g.id === genreId)?.name ?? null;
  }

  const mediaLabel = media === "movie" ? "movies" : media === "tv" ? "shows" : "movies and shows";
  const timeLabel = time ? timeLabels[time as Exclude<Era, "">] : null;

  let desc = "Showing";
  if (genreName) desc += ` ${genreName}`;
  desc += ` ${mediaLabel}`;
  if (timeLabel) desc += ` from ${timeLabel}`;
  if (seeds.length && seedTitles.length) desc += ` based on: ${seedTitles.join(", ")}`;
  desc += ".";
  return desc;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    seeds: url.searchParams.get("seeds") ?? undefined,
    media: url.searchParams.get("media") ?? undefined,
    genre: url.searchParams.get("genre") ?? undefined,
    time: (url.searchParams.get("time") as Era | null) ?? undefined,
    rating: url.searchParams.get("rating") ?? undefined,
    exclude: url.searchParams.get("exclude") ?? undefined,
  });

  if (!parsed.success) {
    return Response.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const { media, genre, time, rating, exclude } = parsed.data;
  const seeds = parseSeeds(parsed.data.seeds);
  const excludeList = parseSeeds(exclude);
  const excludeKeys = new Set([...seeds, ...excludeList].map(seedKey));
  const { gte, lte } = getDateRange(time as Era);

  try {
    let results: MediaItem[];
    let seedTitles: string[] = [];

    if (seeds.length > 0) {
      const [hybrid, seedDetails] = await Promise.all([
        getHybridRecommendations({ seeds, media, genre, time: time as Era, minRating: rating, excludeKeys, limit: 10 }),
        Promise.all(seeds.map((seed) => getTitleDetail(seed.media_type, seed.id, "US").catch(() => null))),
      ]);
      results = hybrid.results;
      seedTitles = seedDetails.filter((d): d is NonNullable<typeof d> => d !== null).map((d) => d.title);
    } else {
      const filters = { genre, dateGte: gte, dateLte: lte, minRating: rating };
      if (media === "movie") {
        results = (await discoverMovies(filters)).slice(0, 10);
      } else if (media === "tv") {
        results = (await discoverTv(filters)).slice(0, 10);
      } else {
        const [movies, tv] = await Promise.all([discoverMovies(filters), discoverTv(filters)]);
        const merged: MediaItem[] = [];
        const max = Math.max(movies.length, tv.length);
        for (let i = 0; i < max; i++) {
          if (i < movies.length) merged.push(movies[i]);
          if (i < tv.length) merged.push(tv[i]);
        }
        results = merged.slice(0, 10);
      }
    }

    const description = await buildDescription(media, genre, time as Era, seeds, seedTitles);

    const body: RecommendationsResponse = { results, description };
    return Response.json(body);
  } catch (error) {
    console.error("GET /api/recommendations failed:", error);
    return Response.json({ error: "Failed to fetch recommendations" }, { status: 500 });
  }
}
