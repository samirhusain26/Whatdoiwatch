import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";

import type { MediaItem, SearchResponse } from "@/lib/media";
import { SectionLabel } from "@/components/ui";

const MAX_SELECTED = 10;
const DEBOUNCE_MS = 300;

async function fetchSearch(query: string): Promise<SearchResponse> {
  const res = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`search failed: ${res.status}`);
  return res.json();
}

interface TitleSearchProps {
  selected: MediaItem[];
  onChange: (next: MediaItem[]) => void;
}

export default function TitleSearch({ selected, onChange }: TitleSearchProps) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [focused, setFocused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  const searchQuery = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => fetchSearch(debounced),
    enabled: debounced.length >= 2,
  });

  const atCap = selected.length >= MAX_SELECTED;

  function addTitle(item: MediaItem) {
    if (atCap) return;
    if (selected.some((s) => s.id === item.id && s.media_type === item.media_type)) return;
    onChange([...selected, item]);
    setQuery("");
    setDebounced("");
  }

  function removeTitle(item: MediaItem) {
    onChange(selected.filter((s) => !(s.id === item.id && s.media_type === item.media_type)));
  }

  const showSuggestions = focused && debounced.length >= 2;
  const results = searchQuery.data?.results ?? [];

  return (
    <View className="gap-2">
      <SectionLabel>Liked Titles</SectionLabel>
      <View className="relative">
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={atCap ? "Max 10 titles selected" : "Search movies & TV shows"}
          placeholderTextColor="#8A8F98"
          editable={!atCap}
          className="rounded-xl bg-panel border border-border px-4 py-3 text-white"
        />
        {showSuggestions && (
          <View className="absolute top-full left-0 right-0 mt-1 rounded-xl bg-panel border border-border z-10 max-h-64 overflow-hidden">
            {searchQuery.isLoading ? (
              <View className="p-3">
                <ActivityIndicator color="#E50914" />
              </View>
            ) : searchQuery.isError ? (
              <Text className="text-warning text-xs p-3">
                Search is unavailable right now.
              </Text>
            ) : results.length === 0 ? (
              <Text className="text-ink-secondary text-xs p-3">No matches found.</Text>
            ) : (
              results.map((item) => (
                <Pressable
                  key={`${item.media_type}:${item.id}`}
                  onPress={() => addTitle(item)}
                  className="flex-row items-center gap-2 px-3 py-2 border-b border-border last:border-b-0"
                >
                  <View className="rounded px-1.5 py-0.5 bg-panel-raised">
                    <Text className="text-white text-[10px] font-bold uppercase">
                      {item.media_type === "tv" ? "TV" : "Movie"}
                    </Text>
                  </View>
                  <Text className="text-white flex-1" numberOfLines={1}>
                    {item.title} {item.year ? `(${item.year})` : ""}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        )}
      </View>

      {selected.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {selected.map((item) => (
            <Pressable
              key={`${item.media_type}:${item.id}`}
              onPress={() => removeTitle(item)}
              className="flex-row items-center gap-1.5 rounded-full bg-panel-raised border border-border px-3 py-1.5"
            >
              <Text className="text-white text-sm" numberOfLines={1}>
                {item.title}
              </Text>
              <Text className="text-ink-tertiary text-sm">&times;</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
