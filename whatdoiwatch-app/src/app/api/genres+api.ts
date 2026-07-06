// GET /api/genres — merged movie+TV genre lists, tagged by media_type.
// Shared names (e.g. "Action") intentionally appear as separate entries per
// GenresResponse { movie: Genre[], tv: Genre[] }. In-memory cached 24h.

import { getMovieGenres, getTvGenres } from "@/lib/tmdb";
import type { GenresResponse } from "@/lib/media";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

let cached: { data: GenresResponse; expiresAt: number } | null = null;

export async function GET() {
  try {
    if (cached && cached.expiresAt > Date.now()) {
      return Response.json(cached.data);
    }

    const [movie, tv] = await Promise.all([getMovieGenres(), getTvGenres()]);
    const data: GenresResponse = { movie, tv };
    cached = { data, expiresAt: Date.now() + TWENTY_FOUR_HOURS_MS };

    return Response.json(data);
  } catch (error) {
    console.error("GET /api/genres failed:", error);
    return Response.json({ error: "Failed to fetch genres" }, { status: 500 });
  }
}
