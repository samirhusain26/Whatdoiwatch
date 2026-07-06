// GET /api/title/:type/:id?region=
// Full details + top-5 cast + first YouTube trailer key (or null, no
// Rickroll fallback) + TMDB watch/providers for the (validated) region +
// Watchmode IMDb rating (falls back to TMDB vote_average on failure).

import { z } from "zod";
import { getTitleDetail } from "@/lib/tmdb";
import { getImdbRating } from "@/lib/watchmode";
import { resolveRegion } from "@/lib/region";
import type { TitleDetail, TitleDetailResponse } from "@/lib/media";

const paramsSchema = z.object({
  type: z.enum(["movie", "tv"]),
  id: z.coerce.number().int().positive(),
});

export async function GET(request: Request, params: { type: string; id: string }) {
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) {
    return Response.json({ error: "Invalid type or id" }, { status: 400 });
  }

  const { type, id } = parsed.data;
  const url = new URL(request.url);
  const region = resolveRegion(url.searchParams.get("region"));

  try {
    const [detail, imdbRating] = await Promise.all([
      getTitleDetail(type, id, region),
      getImdbRating(type, id),
    ]);

    const title: TitleDetail = {
      ...detail,
      imdb_rating: imdbRating ?? detail.vote_average ?? null,
      backdrop: detail.backdrop ?? null,
    };

    const body: TitleDetailResponse = { title };
    return Response.json(body);
  } catch (error) {
    console.error(`GET /api/title/${type}/${id} failed:`, error);
    return Response.json({ error: "Failed to fetch title details" }, { status: 500 });
  }
}
