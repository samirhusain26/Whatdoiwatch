// GET /api/search?query= — TMDB /search/multi, movies+TV only, top 10.

import { z } from "zod";
import { searchMulti } from "@/lib/tmdb";
import type { SearchResponse } from "@/lib/media";

const querySchema = z.object({
  query: z.string().trim().min(1),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    query: url.searchParams.get("query") ?? undefined,
  });

  if (!parsed.success) {
    return Response.json({ error: "Missing or invalid query" }, { status: 400 });
  }

  try {
    const results = (await searchMulti(parsed.data.query)).slice(0, 10);
    const body: SearchResponse = { results };
    return Response.json(body);
  } catch (error) {
    console.error("GET /api/search failed:", error);
    return Response.json({ error: "Failed to search" }, { status: 500 });
  }
}
