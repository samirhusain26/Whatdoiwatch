// Typed fetch wrappers over the TMDB v3 API. Server-only: reads
// process.env.TMDB_API_KEY directly and must never be imported into client
// components. Normalizes movie/TV differences (name/first_air_date vs
// title/release_date) into MediaItem's title/year here so nothing downstream
// has to branch on media_type for basic display fields.

import { TTL, withCache } from "@/lib/api-cache";
import type {
  CastMember,
  Genre,
  MediaItem,
  MediaType,
  WatchProviders,
} from "@/lib/media";

const TMDB_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p";

function apiKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new Error("TMDB_API_KEY is not configured");
  }
  return key;
}

function buildUrl(path: string, params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  search.set("api_key", apiKey());
  search.set("include_adult", "false");
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  return `${TMDB_BASE}${path}?${search.toString()}`;
}

async function tmdbFetch<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<T> {
  const url = buildUrl(path, params);
  const res = await fetch(url);
  if (!res.ok) {
    // Never leak the API key: the key only ever lives in the query string of
    // the outbound request, never in an error message we might surface.
    throw new Error(`TMDB request failed: ${res.status} ${res.statusText} (${path})`);
  }
  return (await res.json()) as T;
}

function posterUrl(posterPath: string | null | undefined, size: string = "w500"): string | null {
  if (!posterPath) return null;
  return `${IMAGE_BASE}/${size}${posterPath}`;
}

function backdropUrl(backdropPath: string | null | undefined, size: string = "w780"): string | null {
  if (!backdropPath) return null;
  return `${IMAGE_BASE}/${size}${backdropPath}`;
}



// ---- Raw TMDB shapes (only the fields we consume) ----

interface TmdbGenre {
  id: number;
  name: string;
}

interface TmdbGenreListResponse {
  genres: TmdbGenre[];
}

interface TmdbMovieResult {
  id: number;
  title: string;
  release_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  vote_average?: number;
  genre_ids?: number[];
  media_type?: string;
}

interface TmdbTvResult {
  id: number;
  name: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  vote_average?: number;
  genre_ids?: number[];
  media_type?: string;
}

interface TmdbPagedResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

interface TmdbCastMember {
  id: number;
  name: string;
  character?: string;
  profile_path?: string | null;
  order?: number;
}

interface TmdbCredits {
  cast?: TmdbCastMember[];
}

interface TmdbVideo {
  key: string;
  site: string;
  type: string;
  official?: boolean;
}

interface TmdbVideosResponse {
  results?: TmdbVideo[];
}

interface TmdbWatchProviderEntry {
  link?: string;
  flatrate?: { provider_id: number; provider_name: string; logo_path: string | null }[];
  rent?: { provider_id: number; provider_name: string; logo_path: string | null }[];
  buy?: { provider_id: number; provider_name: string; logo_path: string | null }[];
}

interface TmdbWatchProvidersResponse {
  results?: Record<string, TmdbWatchProviderEntry>;
}

interface TmdbMovieDetails extends TmdbMovieResult {
  runtime?: number | null;
  credits?: TmdbCredits;
  videos?: TmdbVideosResponse;
  "watch/providers"?: TmdbWatchProvidersResponse;
}

interface TmdbTvDetails extends TmdbTvResult {
  number_of_seasons?: number;
  number_of_episodes?: number;
  credits?: TmdbCredits;
  videos?: TmdbVideosResponse;
  "watch/providers"?: TmdbWatchProvidersResponse;
}

// ---- Normalization helpers ----

function yearFromDate(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null;
  const year = dateStr.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : null;
}

function normalizeMovie(m: TmdbMovieResult): MediaItem {
  return {
    id: m.id,
    media_type: "movie",
    title: m.title,
    year: yearFromDate(m.release_date),
    poster: posterUrl(m.poster_path),
    overview: m.overview,
    vote_average: m.vote_average ?? null,
    genre_ids: m.genre_ids,
  };
}

function normalizeTv(t: TmdbTvResult): MediaItem {
  return {
    id: t.id,
    media_type: "tv",
    title: t.name,
    year: yearFromDate(t.first_air_date),
    poster: posterUrl(t.poster_path),
    overview: t.overview,
    vote_average: t.vote_average ?? null,
    genre_ids: t.genre_ids,
  };
}

function normalizeCast(credits: TmdbCredits | undefined, limit = 5): CastMember[] {
  const cast = credits?.cast ?? [];
  return [...cast]
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .slice(0, limit)
    .map((c) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      profile_path: c.profile_path ?? null,
    }));
}

function firstTrailerKey(videos: TmdbVideosResponse | undefined): string | null {
  const results = videos?.results ?? [];
  const youtube = results.filter((v) => v.site === "YouTube" && v.type === "Trailer");
  const official = youtube.find((v) => v.official);
  return (official ?? youtube[0])?.key ?? null;
}

function normalizeProviders(
  watchProviders: TmdbWatchProvidersResponse | undefined,
  region: string
): WatchProviders {
  const entry = watchProviders?.results?.[region];
  if (!entry) return {};
  return {
    link: entry.link,
    flatrate: entry.flatrate?.map((p) => ({
      provider_id: p.provider_id,
      provider_name: p.provider_name,
      logo_path: p.logo_path,
    })),
    rent: entry.rent?.map((p) => ({
      provider_id: p.provider_id,
      provider_name: p.provider_name,
      logo_path: p.logo_path,
    })),
    buy: entry.buy?.map((p) => ({
      provider_id: p.provider_id,
      provider_name: p.provider_name,
      logo_path: p.logo_path,
    })),
  };
}

// ---- Public API ----

export async function getMovieGenres(): Promise<Genre[]> {
  return withCache("tmdb:genres:movie", TTL.GENRES, async () => {
    const data = await tmdbFetch<TmdbGenreListResponse>("/genre/movie/list");
    return data.genres.map((g) => ({ id: g.id, name: g.name, media_type: "movie" as const }));
  });
}

export async function getTvGenres(): Promise<Genre[]> {
  return withCache("tmdb:genres:tv", TTL.GENRES, async () => {
    const data = await tmdbFetch<TmdbGenreListResponse>("/genre/tv/list");
    return data.genres.map((g) => ({ id: g.id, name: g.name, media_type: "tv" as const }));
  });
}

export async function searchMulti(query: string): Promise<MediaItem[]> {
  const data = await tmdbFetch<TmdbPagedResponse<TmdbMovieResult & TmdbTvResult & { media_type: string }>>(
    "/search/multi",
    { query }
  );
  return data.results
    .filter((r) => r.media_type === "movie" || r.media_type === "tv")
    .map((r) => (r.media_type === "movie" ? normalizeMovie(r) : normalizeTv(r)));
}

export interface DiscoverFilters {
  genre?: string;
  dateGte?: string;
  dateLte?: string;
  minRating?: number;
}

export async function discoverMovies(filters: DiscoverFilters): Promise<MediaItem[]> {
  const data = await tmdbFetch<TmdbPagedResponse<TmdbMovieResult>>("/discover/movie", {
    with_genres: filters.genre,
    sort_by: "popularity.desc",
    "primary_release_date.gte": filters.dateGte,
    "primary_release_date.lte": filters.dateLte,
    "vote_average.gte": filters.minRating,
  });
  return data.results.map(normalizeMovie);
}

export async function discoverTv(filters: DiscoverFilters): Promise<MediaItem[]> {
  const data = await tmdbFetch<TmdbPagedResponse<TmdbTvResult>>("/discover/tv", {
    with_genres: filters.genre,
    sort_by: "popularity.desc",
    "first_air_date.gte": filters.dateGte,
    "first_air_date.lte": filters.dateLte,
    "vote_average.gte": filters.minRating,
  });
  return data.results.map(normalizeTv);
}

async function getMovieRecommendations(id: number): Promise<MediaItem[]> {
  const data = await tmdbFetch<TmdbPagedResponse<TmdbMovieResult>>(`/movie/${id}/recommendations`);
  return data.results.map(normalizeMovie);
}

async function getTvRecommendations(id: number): Promise<MediaItem[]> {
  const data = await tmdbFetch<TmdbPagedResponse<TmdbTvResult>>(`/tv/${id}/recommendations`);
  return data.results.map(normalizeTv);
}

export interface TmdbTitleDetail extends MediaItem {
  cast: CastMember[];
  trailer_key: string | null;
  providers: WatchProviders;
  backdrop: string | null;
  runtime?: number | null;
  number_of_seasons?: number;
  number_of_episodes?: number;
}

async function getMovieDetail(id: number, region: string): Promise<TmdbTitleDetail> {
  return withCache(`tmdb:detail:movie:${id}:${region}`, TTL.DETAIL, async () => {
    const data = await tmdbFetch<TmdbMovieDetails>(`/movie/${id}`, {
      append_to_response: "credits,videos,watch/providers",
    });
    return {
      ...normalizeMovie(data),
      cast: normalizeCast(data.credits),
      trailer_key: firstTrailerKey(data.videos),
      providers: normalizeProviders(data["watch/providers"], region),
      backdrop: backdropUrl(data.backdrop_path),
      runtime: data.runtime ?? null,
    };
  });
}

async function getTvDetail(id: number, region: string): Promise<TmdbTitleDetail> {
  return withCache(`tmdb:detail:tv:${id}:${region}`, TTL.DETAIL, async () => {
    const data = await tmdbFetch<TmdbTvDetails>(`/tv/${id}`, {
      append_to_response: "credits,videos,watch/providers",
    });
    return {
      ...normalizeTv(data),
      cast: normalizeCast(data.credits),
      trailer_key: firstTrailerKey(data.videos),
      providers: normalizeProviders(data["watch/providers"], region),
      backdrop: backdropUrl(data.backdrop_path),
      number_of_seasons: data.number_of_seasons,
      number_of_episodes: data.number_of_episodes,
    };
  });
}

export async function getTitleDetail(type: MediaType, id: number, region: string): Promise<TmdbTitleDetail> {
  return type === "movie" ? getMovieDetail(id, region) : getTvDetail(id, region);
}

export async function getRecommendationsFor(type: MediaType, id: number): Promise<MediaItem[]> {
  return type === "movie" ? getMovieRecommendations(id) : getTvRecommendations(id);
}

// Lightweight (no credits/videos/providers) detail fetch — used by the hybrid
// recommender to resolve poster/overview for candidates that only came from
// the local similarity index (whose seeded DB row has no poster_path yet).
export async function getBasicItem(type: MediaType, id: number): Promise<MediaItem | null> {
  try {
    if (type === "movie") {
      const data = await tmdbFetch<TmdbMovieResult>(`/movie/${id}`);
      return normalizeMovie(data);
    }
    const data = await tmdbFetch<TmdbTvResult>(`/tv/${id}`);
    return normalizeTv(data);
  } catch {
    return null;
  }
}

let genreNameToIdCache: { movie: Map<string, number>; tv: Map<string, number> } | null = null;

/** Local DB rows store genre NAMES (the pipeline's soup recipe needs names,
 *  not ids); the rest of the app filters by TMDB genre id. Resolve names to
 *  ids via the same genre lists already used for /api/genres, cached
 *  in-memory since genre lists are effectively static. */
export async function resolveGenreIds(names: string[], mediaType: MediaType): Promise<number[]> {
  if (!genreNameToIdCache) {
    const [movieGenres, tvGenres] = await Promise.all([getMovieGenres(), getTvGenres()]);
    genreNameToIdCache = {
      movie: new Map(movieGenres.map((g) => [g.name, g.id])),
      tv: new Map(tvGenres.map((g) => [g.name, g.id])),
    };
  }
  const map = genreNameToIdCache[mediaType];
  return names.map((n) => map.get(n)).filter((id): id is number => id !== undefined);
}
