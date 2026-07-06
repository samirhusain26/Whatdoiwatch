// Movie Night consensus picker. Everyone calls out a title they'd recommend,
// one person types the whole list in (one per line), the app resolves each
// to a TMDB title via /api/search and then reuses the existing hybrid
// recommender (/api/recommendations) with every resolved title as a seed.
// The recommender already sums local+live scores across all seeds, so a
// candidate similar to several people's picks naturally outranks one that
// only matches a single person's pick — exactly the "closest to the whole
// group" behavior a movie night needs. No new scoring logic required.

import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import type { MediaItem, RecommendationsResponse, SearchResponse } from "@/lib/media";
import { serializeSeeds } from "@/lib/media";
import TitleGrid from "@/components/TitleGrid";
import { Panel, PrimaryButton, SectionLabel } from "@/components/ui";

function splitLines(input: string): string[] {
  return input
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function resolveTitle(query: string): Promise<MediaItem | null> {
  const res = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
  if (!res.ok) return null;
  const data: SearchResponse = await res.json();
  return data.results[0] ?? null;
}

async function fetchRecommendations(seeds: MediaItem[]): Promise<RecommendationsResponse> {
  const params = new URLSearchParams({ media: "all" });
  params.set("seeds", serializeSeeds(seeds.map((s) => ({ media_type: s.media_type, id: s.id }))));
  const res = await fetch(`/api/recommendations?${params.toString()}`);
  if (!res.ok) throw new Error(`recommendations failed: ${res.status}`);
  return res.json();
}

function keyOf(item: Pick<MediaItem, "media_type" | "id">): string {
  return `${item.media_type}:${item.id}`;
}

export default function GroupScreen() {
  const [text, setText] = useState("");
  const [resolved, setResolved] = useState<MediaItem[]>([]);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [isResolving, setIsResolving] = useState(false);
  const [isRecommending, setIsRecommending] = useState(false);
  const [results, setResults] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFindPick() {
    setError(null);
    setResults(null);

    const lines = splitLines(text);
    if (lines.length === 0) {
      setError("Add at least one title, one per line.");
      return;
    }

    setIsResolving(true);
    const found: MediaItem[] = [];
    const missed: string[] = [];
    try {
      const matches = await Promise.all(lines.map((line) => resolveTitle(line)));
      matches.forEach((match, i) => {
        if (match && !found.some((f) => keyOf(f) === keyOf(match))) {
          found.push(match);
        } else if (!match) {
          missed.push(lines[i]);
        }
      });
    } finally {
      setIsResolving(false);
    }

    setResolved(found);
    setUnmatched(missed);

    if (found.length === 0) {
      setError("Couldn't match any of those titles. Check the spelling and try again.");
      return;
    }

    await runRecommendations(found);
  }

  async function runRecommendations(seeds: MediaItem[]) {
    setIsRecommending(true);
    setError(null);
    try {
      const data = await fetchRecommendations(seeds);
      setResults(data.results);
    } catch {
      setError("Couldn't reach the recommendation service. Try again shortly.");
    } finally {
      setIsRecommending(false);
    }
  }

  function removeResolved(item: MediaItem) {
    const next = resolved.filter((r) => keyOf(r) !== keyOf(item));
    setResolved(next);
    if (next.length > 0) {
      runRecommendations(next);
    } else {
      setResults(null);
    }
  }

  const isBusy = isResolving || isRecommending;

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ padding: 16, gap: 16 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View className="gap-1 py-2">
        <Text className="text-white text-2xl font-bold">Movie Night</Text>
        <Text className="text-ink-secondary text-sm">
          Everyone throws out a pick, we find the one that fits the whole group
        </Text>
      </View>

      <View className="gap-2">
        <SectionLabel>One title per line (or comma-separated)</SectionLabel>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          numberOfLines={5}
          placeholder={"The Dark Knight\nInception\nThe Office"}
          placeholderTextColor="#8A8F98"
          className="rounded-xl bg-panel border border-border px-4 py-3 text-white min-h-[120px]"
          style={{ textAlignVertical: "top" }}
        />
      </View>

      <PrimaryButton
        label={isBusy ? "Finding your pick..." : "Find Our Movie"}
        onPress={handleFindPick}
        disabled={isBusy || text.trim().length === 0}
        className={isBusy || text.trim().length === 0 ? "opacity-50" : ""}
      />

      {error && (
        <Panel className="p-3">
          <Text className="text-warning text-sm text-center">{error}</Text>
        </Panel>
      )}

      {unmatched.length > 0 && (
        <Panel className="p-3">
          <Text className="text-ink-tertiary text-xs text-center">
            Couldn&apos;t find a match for: {unmatched.join(", ")}
          </Text>
        </Panel>
      )}

      {resolved.length > 0 && (
        <View className="gap-2">
          <SectionLabel>
            Matched {resolved.length} pick{resolved.length === 1 ? "" : "s"}
          </SectionLabel>
          <View className="flex-row flex-wrap gap-2">
            {resolved.map((item) => (
              <Pressable
                key={keyOf(item)}
                onPress={() => removeResolved(item)}
                className="flex-row items-center gap-1.5 rounded-full bg-panel-raised border border-border px-3 py-1.5"
              >
                <Text className="text-white text-sm" numberOfLines={1}>
                  {item.title} {item.year ? `(${item.year})` : ""}
                </Text>
                <Text className="text-ink-tertiary text-sm">&times;</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {isRecommending && (
        <View className="items-center py-8">
          <ActivityIndicator color="#E50914" size="large" />
        </View>
      )}

      {results && results.length > 0 && (
        <View className="gap-3">
          <Text className="text-white text-lg font-bold">Best fit for everyone</Text>
          <TitleGrid items={results} isLoading={false} isError={false} />
        </View>
      )}

      {results && results.length === 0 && !isRecommending && (
        <Panel className="p-6 items-center gap-2">
          <Text className="text-white text-base font-semibold">No consensus pick found</Text>
          <Text className="text-ink-secondary text-sm text-center">
            Try different titles, or fewer of them — very different picks may not share any close
            matches.
          </Text>
        </Panel>
      )}
    </ScrollView>
  );
}
