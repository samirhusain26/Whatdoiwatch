import { useState } from "react";
import { ActivityIndicator, Platform, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import type { FilterState } from "@/components/FilterBar";
import FilterBar from "@/components/FilterBar";
import TitleDetailSheet from "@/components/TitleDetailSheet";
import TitleGrid from "@/components/TitleGrid";
import { PrimaryButton, Panel, SectionLabel } from "@/components/ui";
import type { SurpriseResponse } from "@/lib/media";

const DEFAULT_FILTERS: FilterState = { media: "all", genre: "", era: "", rating: 0 };

async function fetchSurprise(filters: FilterState, spin: number): Promise<SurpriseResponse> {
  const params = new URLSearchParams();
  params.set("media", filters.media);
  if (filters.genre) params.set("genre", filters.genre);
  if (filters.era) params.set("time", filters.era);
  if (filters.rating > 0) params.set("rating", String(filters.rating));
  if (typeof navigator !== "undefined" && navigator.language) {
    const region = navigator.language.split("-")[1];
    if (region) params.set("region", region);
  }
  // spin is only used to force React Query to refetch on "Spin again" —
  // the endpoint itself is non-deterministic (random pick) so a cache hit
  // would otherwise return the same title.
  const res = await fetch(`/api/surprise?${params.toString()}&spin=${spin}`);
  if (!res.ok) throw new Error(`surprise failed: ${res.status}`);
  return res.json();
}

export default function SurpriseScreen() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [spin, setSpin] = useState(0);
  const [started, setStarted] = useState(false);

  const surpriseQuery = useQuery({
    queryKey: ["surprise", filters, spin],
    queryFn: () => fetchSurprise(filters, spin),
    enabled: started,
  });

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ padding: 16, gap: 16 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View className="gap-1 py-2">
        <Text className="text-white text-3xl font-bold">Surprise Me</Text>
        <Text className="text-ink-secondary text-sm">One tap, one pick — see where it takes you</Text>
      </View>

      <FilterBar value={filters} onChange={setFilters} />

      <PrimaryButton
        label={started ? "Spin Again" : "Surprise Me!"}
        onPress={() => {
          if (Platform.OS === "ios") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          setStarted(true);
          setSpin((s) => s + 1);
        }}
      />

      {started && surpriseQuery.isLoading && (
        <View className="items-center py-8">
          <ActivityIndicator color="#E50914" size="large" />
        </View>
      )}

      {started && surpriseQuery.isError && (
        <Panel className="p-6 items-center gap-2">
          <Text className="text-warning text-base font-semibold">Something went wrong</Text>
          <Text className="text-ink-secondary text-sm text-center">
            Couldn&apos;t get a pick right now. Try spinning again.
          </Text>
        </Panel>
      )}

      {started && surpriseQuery.data && (
        <>
          {surpriseQuery.data.relaxed && (
            <View className="rounded-xl bg-panel border border-warning/30 p-3">
              <Text className="text-warning text-xs text-center">
                Not enough matches — {surpriseQuery.data.relaxedNote?.toLowerCase()} to find you a
                pick.
              </Text>
            </View>
          )}

          {surpriseQuery.data.picked ? (
            <View className="rounded-2xl bg-tile border border-border-tile overflow-hidden">
              <TitleDetailSheet detail={surpriseQuery.data.picked} isLoading={false} isError={false} />
            </View>
          ) : (
            <Panel className="p-6 items-center gap-2">
              <Text className="text-white text-base font-semibold">No matches found</Text>
              <Text className="text-ink-secondary text-sm text-center">
                Try loosening your filters and spinning again.
              </Text>
            </Panel>
          )}

          {surpriseQuery.data.similar.length > 0 && (
            <View className="gap-3">
              <SectionLabel>10 Similar Picks</SectionLabel>
              <TitleGrid items={surpriseQuery.data.similar} isLoading={false} isError={false} />
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
