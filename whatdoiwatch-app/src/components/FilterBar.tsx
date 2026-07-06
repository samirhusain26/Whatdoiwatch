import { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";

import type { Era, Genre, GenresResponse, MediaFilter } from "@/lib/media";
import { SectionLabel, Chip } from "@/components/ui";

const MEDIA_OPTIONS: { value: MediaFilter; label: string }[] = [
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV" },
  { value: "all", label: "All" },
];

export const ERA_OPTIONS: { value: Era; label: string }[] = [
  { value: "", label: "Any Time" },
  { value: "this_month", label: "This Month" },
  { value: "this_year", label: "This Year" },
  { value: "this_decade", label: "This Decade" },
  { value: "last_decade", label: "Last Decade" },
  { value: "this_century", label: "This Century" },
  { value: "old", label: "Old (1980-1999)" },
  { value: "ancient", label: "Ancient (before 1980)" },
];

async function fetchGenres(): Promise<GenresResponse> {
  const res = await fetch("/api/genres");
  if (!res.ok) throw new Error(`genres failed: ${res.status}`);
  return res.json();
}

export interface FilterState {
  media: MediaFilter;
  genre: string;
  era: Era;
  rating: number;
}

interface FilterBarProps {
  value: FilterState;
  onChange: (next: FilterState) => void;
}

function dedupeGenres(list: Genre[]): Genre[] {
  const seen = new Map<number, Genre>();
  for (const g of list) {
    if (!seen.has(g.id)) seen.set(g.id, g);
  }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export default function FilterBar({ value, onChange }: FilterBarProps) {
  const genresQuery = useQuery({
    queryKey: ["genres"],
    queryFn: fetchGenres,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const genreOptions = useMemo(() => {
    const data = genresQuery.data;
    if (!data) return [];
    if (value.media === "movie") return dedupeGenres(data.movie);
    if (value.media === "tv") return dedupeGenres(data.tv);
    return dedupeGenres([...data.movie, ...data.tv]);
  }, [genresQuery.data, value.media]);

  function setMedia(media: MediaFilter) {
    onChange({ ...value, media, genre: "" });
  }

  function setGenre(genre: string) {
    onChange({ ...value, genre });
  }

  function setEra(era: Era) {
    onChange({ ...value, era });
  }

  function bumpRating(delta: number) {
    const next = Math.min(10, Math.max(0, Math.round((value.rating + delta) * 10) / 10));
    onChange({ ...value, rating: next });
  }

  return (
    <View className="rounded-xl bg-panel border border-border p-4 gap-4">
      {/* Media toggle */}
      <View className="flex-row rounded-xl bg-panel-raised p-1 gap-1">
        {MEDIA_OPTIONS.map((opt) => {
          const active = value.media === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setMedia(opt.value)}
              className={`flex-1 items-center justify-center rounded-lg py-2 ${
                active ? "bg-accent" : ""
              }`}
            >
              <Text className={active ? "text-white font-semibold" : "text-ink-secondary"}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Genre chips */}
      <View className="gap-2">
        <SectionLabel>Genre</SectionLabel>
        {genresQuery.isLoading ? (
          <ActivityIndicator color="#E50914" />
        ) : genresQuery.isError ? (
          <Text className="text-warning text-xs">Couldn&apos;t load genres.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2 pr-2">
              <Chip
                label="Any Genre"
                active={value.genre === ""}
                onPress={() => setGenre("")}
              />
              {genreOptions.map((g) => (
                <Chip
                  key={g.id}
                  label={g.name}
                  active={value.genre === String(g.id)}
                  onPress={() => setGenre(String(g.id))}
                />
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Era chips */}
      <View className="gap-2">
        <SectionLabel>When</SectionLabel>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2 pr-2">
            {ERA_OPTIONS.map((opt) => (
              <Chip
                key={opt.value || "any"}
                label={opt.label}
                active={value.era === opt.value}
                onPress={() => setEra(opt.value)}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Rating stepper */}
      <View className="gap-2">
        <SectionLabel>Min Rating: {value.rating.toFixed(1)}</SectionLabel>
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => bumpRating(-0.5)}
            className="h-9 w-9 items-center justify-center rounded-full bg-panel-raised border border-border"
          >
            <Text className="text-white text-lg leading-none">-</Text>
          </Pressable>
          <View className="flex-1 h-2 rounded-full bg-panel-raised overflow-hidden">
            <View
              className="h-2 bg-accent"
              style={{ width: `${(value.rating / 10) * 100}%` }}
            />
          </View>
          <Pressable
            onPress={() => bumpRating(0.5)}
            className="h-9 w-9 items-center justify-center rounded-full bg-panel-raised border border-border"
          >
            <Text className="text-white text-lg leading-none">+</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
