// Phase 2.4 — hybrid recommendation engine. Replaces the v1 per-seed-only
// logic in app/api/recommendations+api.ts with a blend of:
//   1. Local candidates: precomputed cosine-similarity neighbors from
//      similar_titles (scripts/export_neighbors.py output, seeded via
//      scripts/seed.ts).
//   2. Live candidates: TMDB's own /recommendations per seed (covers titles
//      newer than the corpus).
// Scores are merged per the locked decision: normalized
// score = 0.6 * local_cosine + 0.4 * live_rank_score, boosted when a
// candidate appears in both sources, summed across seeds that surface it.

import { and, eq, or } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { similarTitles, titles } from "@/lib/db/schema";
import { getDateRange } from "@/lib/dates";
import type { Era, MediaFilter, MediaItem, MediaType, Seed } from "@/lib/media";
import { getBasicItem, getRecommendationsFor, resolveGenreIds } from "@/lib/tmdb";

const LOCAL_WEIGHT = 0.6;
const LIVE_WEIGHT = 0.4;
const BOTH_SOURCES_BOOST = 0.15;
const CROSS_TYPE_CAP_RATIO = 0.3; // in "all" mode, cap the share of results whose
// media_type differs from every seed's media_type

function key(mediaType: MediaType, id: number): string {
  return `${mediaType}:${id}`;
}

interface Candidate {
  mediaType: MediaType;
  id: number;
  localScore: number;
  liveScore: number;
  inLocal: boolean;
  inLive: boolean;
  liveItem: MediaItem | null; // full MediaItem if sourced from TMDB /recommendations
}

interface RecommenderOptions {
  seeds: Seed[];
  media: MediaFilter;
  genre?: string;
  time: Era;
  minRating?: number;
  excludeKeys: Set<string>;
  limit?: number;
}

export interface RecommenderResult {
  results: MediaItem[];
  seedTitles: string[];
}

async function fetchLocalNeighbors(seed: Seed) {
  return db
    .select()
    .from(similarTitles)
    .where(and(eq(similarTitles.srcType, seed.media_type), eq(similarTitles.srcId, seed.id)));
}

function matchesEra(year: number | null, gte: string, lte: string): boolean {
  if (!year) return true;
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  return end >= gte && start <= lte;
}

export async function getHybridRecommendations(opts: RecommenderOptions): Promise<RecommenderResult> {
  const { seeds, media, genre, time, minRating, excludeKeys } = opts;
  const limit = opts.limit ?? 10;
  const { gte, lte } = getDateRange(time);

  const candidates = new Map<string, Candidate>();

  function bump(mediaType: MediaType, id: number, patch: Partial<Candidate>) {
    const k = key(mediaType, id);
    const existing = candidates.get(k) ?? {
      mediaType,
      id,
      localScore: 0,
      liveScore: 0,
      inLocal: false,
      inLive: false,
      liveItem: null,
    };
    candidates.set(k, {
      ...existing,
      ...patch,
      localScore: existing.localScore + (patch.localScore ?? 0),
      liveScore: existing.liveScore + (patch.liveScore ?? 0),
      inLocal: existing.inLocal || Boolean(patch.inLocal),
      inLive: existing.inLive || Boolean(patch.inLive),
      liveItem: patch.liveItem ?? existing.liveItem,
    });
  }

  // Local candidates (per seed, from the precomputed neighbor table).
  const localLists = await Promise.all(seeds.map((seed) => fetchLocalNeighbors(seed)));
  for (const neighborList of localLists) {
    for (const n of neighborList) {
      if (seeds.some((s) => s.media_type === n.dstType && s.id === n.dstId)) continue; // never recommend a seed back
      bump(n.dstType as MediaType, n.dstId, { localScore: n.score, inLocal: true });
    }
  }

  // Live candidates (TMDB /recommendations per seed).
  const liveLists = await Promise.all(seeds.map((seed) => getRecommendationsFor(seed.media_type, seed.id)));
  const seedKeySet = new Set(seeds.map((s) => key(s.media_type, s.id)));
  for (const liveList of liveLists) {
    const n = liveList.length;
    liveList.forEach((item, rank) => {
      const k = key(item.media_type, item.id);
      if (seedKeySet.has(k)) return;
      const rankScore = n > 1 ? 1 - rank / n : 1;
      bump(item.media_type, item.id, { liveScore: rankScore, inLive: true, liveItem: item });
    });
  }

  // Score + boost.
  const scored = [...candidates.values()].map((c) => {
    let score = LOCAL_WEIGHT * c.localScore + LIVE_WEIGHT * c.liveScore;
    if (c.inLocal && c.inLive) score += BOTH_SOURCES_BOOST;
    return { ...c, score };
  });
  scored.sort((a, b) => b.score - a.score);

  // Exclude seeds/exclude-list, then resolve local-only rows (title/year/genres
  // come from the seeded DB; poster/overview get backfilled from TMDB below).
  const localOnlyIds = scored.filter((c) => !c.liveItem).map((c) => ({ mediaType: c.mediaType, id: c.id }));
  const localRows = localOnlyIds.length
    ? await db
        .select()
        .from(titles)
        .where(
          or(
            ...localOnlyIds.map((c) => and(eq(titles.mediaType, c.mediaType), eq(titles.id, c.id))!),
          ),
        )
    : [];
  const localRowByKey = new Map(localRows.map((r) => [key(r.mediaType as MediaType, r.id), r]));

  const genreIdCache = new Map<string, number[]>();
  async function genreIdsFor(mediaType: MediaType, names: string[]): Promise<number[]> {
    const cacheKey = `${mediaType}:${names.join(",")}`;
    const cached = genreIdCache.get(cacheKey);
    if (cached) return cached;
    const ids = await resolveGenreIds(names, mediaType);
    genreIdCache.set(cacheKey, ids);
    return ids;
  }

  type Filterable = { mediaType: MediaType; id: number; score: number; item: MediaItem | null; year: number | null; genreIds: number[]; voteAverage: number | null };

  const filterable: Filterable[] = [];
  for (const c of scored) {
    const k = key(c.mediaType, c.id);
    if (excludeKeys.has(k)) continue;
    if (c.liveItem) {
      const genreIds = c.liveItem.genre_ids ?? [];
      filterable.push({
        mediaType: c.mediaType,
        id: c.id,
        score: c.score,
        item: c.liveItem,
        year: c.liveItem.year ? Number(c.liveItem.year) : null,
        genreIds,
        voteAverage: c.liveItem.vote_average ?? null,
      });
      continue;
    }
    const row = localRowByKey.get(k);
    if (!row) continue;
    const genreIds = await genreIdsFor(c.mediaType, (row.genres as unknown as string[]) ?? []);
    filterable.push({
      mediaType: c.mediaType,
      id: c.id,
      score: c.score,
      item: null,
      year: row.year,
      genreIds,
      voteAverage: row.voteAverage,
    });
  }

  // Filter: media, genre, era, rating.
  const genreId = genre ? Number(genre) : undefined;
  const seedMediaTypes = new Set(seeds.map((s) => s.media_type));
  const filtered = filterable.filter((c) => {
    if (media !== "all" && c.mediaType !== media) return false;
    if (genreId !== undefined && !c.genreIds.includes(genreId)) return false;
    if (!matchesEra(c.year, gte, lte)) return false;
    if (minRating !== undefined && (c.voteAverage ?? 0) < minRating) return false;
    return true;
  });

  // Cross-type cap (only meaningful in "all" mode with a single dominant seed type).
  const finalItems: Filterable[] = [];
  if (media === "all" && seedMediaTypes.size === 1) {
    const dominant = [...seedMediaTypes][0];
    const capCount = Math.ceil(limit * CROSS_TYPE_CAP_RATIO);
    let crossTypeUsed = 0;
    const overflow: Filterable[] = [];
    for (const c of filtered) {
      if (finalItems.length >= limit) break;
      if (c.mediaType !== dominant) {
        if (crossTypeUsed < capCount) {
          finalItems.push(c);
          crossTypeUsed++;
        } else {
          overflow.push(c);
        }
      } else {
        finalItems.push(c);
      }
    }
    for (const c of overflow) {
      if (finalItems.length >= limit) break;
      finalItems.push(c);
    }
  } else {
    finalItems.push(...filtered.slice(0, limit));
  }

  // Resolve display data (poster/overview) for local-only candidates in the
  // final slice only — keeps TMDB calls bounded to what's actually returned.
  const resolved = await Promise.all(
    finalItems.map(async (c): Promise<MediaItem | null> => {
      if (c.item) return c.item;
      const basic = await getBasicItem(c.mediaType, c.id);
      if (basic) return basic;
      // Fall back to local metadata (no poster) rather than dropping the candidate.
      const row = localRowByKey.get(key(c.mediaType, c.id));
      if (!row) return null;
      return {
        id: c.id,
        media_type: c.mediaType,
        title: row.title,
        year: row.year ? String(row.year) : null,
        poster: null,
        overview: row.overview ?? undefined,
        vote_average: row.voteAverage,
        genre_ids: c.genreIds,
      };
    }),
  );

  const results = resolved.filter((r): r is MediaItem => r !== null);

  return { results, seedTitles: [] };
}
