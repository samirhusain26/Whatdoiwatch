import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type {
  DiscoverResponse,
  Genre,
  MediaItem,
  RecommendationsResponse,
  Seed,
} from "@/lib/media";
import { serializeSeeds } from "@/lib/media";
import FilterBar, { ERA_OPTIONS, type FilterState } from "@/components/FilterBar";
import TitleSearch from "@/components/TitleSearch";
import TitleGrid from "@/components/TitleGrid";
import { getExcludeList } from "@/lib/db/watchlist-queries";
import { getLastFilters, getLikedTitles, setLastFilters, setLikedTitles } from "@/lib/db/prefs-queries";

const DEFAULT_FILTERS: FilterState = {
  media: "all",
  genre: "",
  era: "",
  rating: 0,
};

async function fetchDiscover(filters: FilterState): Promise<DiscoverResponse> {
  const params = new URLSearchParams();
  params.set("media", filters.media);
  if (filters.genre) params.set("genre", filters.genre);
  if (filters.era) params.set("time", filters.era);
  if (filters.rating > 0) params.set("rating", String(filters.rating));
  const res = await fetch(`/api/discover?${params.toString()}`);
  if (!res.ok) throw new Error(`discover failed: ${res.status}`);
  return res.json();
}

async function fetchRecommendations(
  filters: FilterState,
  seeds: MediaItem[],
  exclude: Seed[]
): Promise<RecommendationsResponse> {
  const params = new URLSearchParams();
  params.set("seeds", serializeSeeds(seeds.map((s) => ({ media_type: s.media_type, id: s.id }))));
  params.set("media", filters.media);
  if (filters.genre) params.set("genre", filters.genre);
  if (filters.era) params.set("time", filters.era);
  if (filters.rating > 0) params.set("rating", String(filters.rating));
  if (exclude.length > 0) params.set("exclude", serializeSeeds(exclude));
  const res = await fetch(`/api/recommendations?${params.toString()}`);
  if (!res.ok) throw new Error(`recommendations failed: ${res.status}`);
  return res.json();
}

function buildDescription(
  filters: FilterState,
  selected: MediaItem[],
  genreLookup: Map<string, string>
): string {
  const mediaWord =
    filters.media === "movie" ? "movies" : filters.media === "tv" ? "shows" : "movies and shows";
  const genreName = filters.genre ? genreLookup.get(filters.genre) : null;
  const eraLabel = filters.era
    ? ERA_OPTIONS.find((o) => o.value === filters.era)?.label
    : null;

  let desc = "Showing";
  if (genreName) desc += ` ${genreName}`;
  desc += ` ${mediaWord}`;
  if (eraLabel) desc += ` from ${eraLabel.toLowerCase()}`;
  if (filters.rating > 0) desc += ` rated ${filters.rating.toFixed(1)}+`;
  if (selected.length > 0) {
    desc += ` based on: ${selected.map((s) => s.title).join(", ")}`;
  }
  desc += ".";
  return desc;
}

export default function HomeScreen() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<MediaItem[]>([]);
  const [excludeList, setExcludeList] = useState<Seed[]>([]);
  const hasHydrated = useRef(false);

  // Hydrate persisted filters/liked-titles once on mount so returning users
  // don't start from scratch (plan 3.4), and load the exclude list so
  // seen/not-interested titles never reappear (plan 3.3).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [persistedFilters, persistedLiked, exclude] = await Promise.all([
        getLastFilters(),
        getLikedTitles(),
        getExcludeList(),
      ]);
      if (cancelled) return;
      if (persistedFilters) setFilters(persistedFilters);
      if (persistedLiked.length > 0) setSelected(persistedLiked);
      setExcludeList(exclude);
      hasHydrated.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist filters/liked-titles back whenever they change (post-hydration).
  useEffect(() => {
    if (!hasHydrated.current) return;
    setLastFilters(filters);
  }, [filters]);

  useEffect(() => {
    if (!hasHydrated.current) return;
    setLikedTitles(selected);
  }, [selected]);

  // Refresh the exclude list whenever this screen regains focus, e.g. after
  // marking a title seen/not-interested from the detail screen.
  useFocusEffect(
    useCallback(() => {
      if (!hasHydrated.current) return;
      getExcludeList().then(setExcludeList);
    }, [])
  );

  const genresQuery = useQuery<{ movie: Genre[]; tv: Genre[] }>({
    queryKey: ["genres"],
    queryFn: async () => {
      const res = await fetch("/api/genres");
      if (!res.ok) throw new Error("genres failed");
      return res.json();
    },
    staleTime: 24 * 60 * 60 * 1000,
  });

  const genreLookup = useMemo(() => {
    const map = new Map<string, string>();
    const data = genresQuery.data;
    if (data) {
      for (const g of [...data.movie, ...data.tv]) {
        map.set(String(g.id), g.name);
      }
    }
    return map;
  }, [genresQuery.data]);

  const hasSeeds = selected.length > 0;

  const discoverQuery = useQuery({
    queryKey: ["discover", filters],
    queryFn: () => fetchDiscover(filters),
    enabled: !hasSeeds,
  });

  const recommendationsQuery = useQuery({
    queryKey: [
      "recommendations",
      filters,
      selected.map((s) => `${s.media_type}:${s.id}`),
      excludeList.map((s) => `${s.media_type}:${s.id}`),
    ],
    queryFn: () => fetchRecommendations(filters, selected, excludeList),
    enabled: hasSeeds,
  });

  const activeQuery = hasSeeds ? recommendationsQuery : discoverQuery;
  const results: MediaItem[] = hasSeeds
    ? recommendationsQuery.data?.results ?? []
    : discoverQuery.data?.results ?? [];

  const [isRefreshing, setIsRefreshing] = useState(false);
  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await activeQuery.refetch();
    } finally {
      setIsRefreshing(false);
    }
  }

  const description =
    recommendationsQuery.data?.description ?? buildDescription(filters, selected, genreLookup);

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ padding: 16, gap: 16 }}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#E50914" />
      }
    >
      <View className="gap-1 py-2">
        <Text className="text-white text-2xl font-bold">What Do I Watch</Text>
        <Text className="text-ink-secondary text-sm">Find your next movie or show</Text>
      </View>

      <FilterBar value={filters} onChange={setFilters} />
      <TitleSearch selected={selected} onChange={setSelected} />

      <Text className="text-ink-secondary text-sm text-center">{description}</Text>

      <TitleGrid
        items={results}
        isLoading={activeQuery.isLoading}
        isError={activeQuery.isError}
        errorMessage="We couldn't reach the recommendation service. Please try again shortly."
      />
    </ScrollView>
  );
}
