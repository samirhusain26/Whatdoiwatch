// Shared contracts consumed by lib/, components/, and app/api routes.
// TV and movie responses from TMDB are normalized into these shapes at the
// edge (lib/tmdb.ts) so nothing downstream needs to branch on media_type
// except for display concerns (badges, seasons vs runtime, etc).

export type MediaType = "movie" | "tv";
export type MediaFilter = "movie" | "tv" | "all";

export type Era =
  | "this_month"
  | "this_year"
  | "this_decade"
  | "last_decade"
  | "this_century"
  | "old"
  | "ancient"
  | "";

export interface Genre {
  id: number;
  name: string;
  media_type: MediaType | "both";
}

/** Light-weight shape used in grids, search results, and liked-title chips. */
export interface MediaItem {
  id: number;
  media_type: MediaType;
  title: string;
  year: string | null;
  poster: string | null;
  overview?: string;
  vote_average?: number | null;
  genre_ids?: number[];
}

export interface CastMember {
  id: number;
  name: string;
  character?: string;
  profile_path?: string | null;
}

export interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
}

export interface WatchProviders {
  link?: string;
  flatrate?: WatchProvider[];
  rent?: WatchProvider[];
  buy?: WatchProvider[];
}

/** Full payload for the title detail route/sheet. */
export interface TitleDetail extends MediaItem {
  cast: CastMember[];
  trailer_key: string | null;
  providers: WatchProviders;
  imdb_rating: number | null;
  backdrop: string | null;
  runtime?: number | null;
  number_of_seasons?: number;
  number_of_episodes?: number;
  rec_source?: "local" | "live" | "both";
}

export interface Seed {
  media_type: MediaType;
  id: number;
}

/** Parses/serializes the `seeds=movie:603,tv:1396` query param used across
 *  /api/recommendations and the client. */
export function parseSeeds(param: string | null | undefined): Seed[] {
  if (!param) return [];
  return param
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [media_type, id] = s.split(":");
      return { media_type: media_type as MediaType, id: Number(id) };
    })
    .filter((s) => s.id && (s.media_type === "movie" || s.media_type === "tv"));
}

export function serializeSeeds(seeds: Seed[]): string {
  return seeds.map((s) => `${s.media_type}:${s.id}`).join(",");
}

// ---- API route request/response contracts ----

export interface GenresResponse {
  movie: Genre[];
  tv: Genre[];
}

export interface SearchResponse {
  results: MediaItem[];
}

export interface DiscoverResponse {
  results: MediaItem[];
}

export interface RecommendationsResponse {
  results: MediaItem[];
  description: string;
}

export interface TitleDetailResponse {
  title: TitleDetail;
}

export interface SurpriseResponse {
  picked: TitleDetail | null;
  similar: MediaItem[];
  relaxed: boolean;
  relaxedNote?: string;
}
