// Tinder-style swipe deck. Building blocks reused from the rest of the app:
// /api/discover for the candidate pool, /api/genres to rotate through
// flavors for variety (discover has no page param), and the existing
// watchlist table (want_to_watch = like, not_interested = dislike) as the
// taste-signal store, per the locked decision to reuse that schema rather
// than add a parallel `swipes` table. "Not watched" (swipe up / the "?"
// button) is a pure pass — no opinion, nothing persisted, never shown again
// this session only.
//
// "For You" mode reuses /api/recommendations directly with the most-recent
// liked titles as seeds (same hybrid local+live engine the home screen
// uses) — no new recommendation logic needed.

import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

import type { DiscoverResponse, Genre, GenresResponse, MediaItem, RecommendationsResponse } from "@/lib/media";
import { serializeSeeds } from "@/lib/media";
import { addToWatchlist, getWatchlist } from "@/lib/db/watchlist-queries";
import SwipeCard, { type SwipeCardHandle, type SwipeDirection } from "@/components/SwipeCard";
import TitleGrid from "@/components/TitleGrid";
import { Panel, SectionLabel } from "@/components/ui";

const MAX_SEEDS = 10;
const REFILL_THRESHOLD = 3;

function keyOf(item: Pick<MediaItem, "media_type" | "id">): string {
  return `${item.media_type}:${item.id}`;
}

function dedupeGenres(list: Genre[]): Genre[] {
  const seen = new Map<number, Genre>();
  for (const g of list) if (!seen.has(g.id)) seen.set(g.id, g);
  return Array.from(seen.values());
}

async function fetchGenres(): Promise<GenresResponse> {
  const res = await fetch("/api/genres");
  if (!res.ok) throw new Error("genres failed");
  return res.json();
}

async function fetchDiscoverBatch(genreId?: number): Promise<MediaItem[]> {
  const params = new URLSearchParams({ media: "all" });
  if (genreId) params.set("genre", String(genreId));
  const res = await fetch(`/api/discover?${params.toString()}`);
  if (!res.ok) throw new Error("discover failed");
  const data: DiscoverResponse = await res.json();
  return data.results;
}

async function fetchRecommendations(seeds: MediaItem[]): Promise<RecommendationsResponse> {
  const params = new URLSearchParams({ media: "all" });
  params.set("seeds", serializeSeeds(seeds.map((s) => ({ media_type: s.media_type, id: s.id }))));
  const res = await fetch(`/api/recommendations?${params.toString()}`);
  if (!res.ok) throw new Error("recommendations failed");
  return res.json();
}

function haptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export default function SwipeScreen() {
  const [pool, setPool] = useState<MediaItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedItems, setLikedItems] = useState<MediaItem[]>([]);
  const [likedCount, setLikedCount] = useState(0);
  const [dislikedCount, setDislikedCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(true);
  const [mode, setMode] = useState<"swipe" | "foryou">("swipe");
  const [recs, setRecs] = useState<MediaItem[] | null>(null);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsError, setRecsError] = useState(false);

  const genresRef = useRef<Genre[]>([]);
  const rotationRef = useRef(0);
  const excludedRef = useRef<Set<string>>(new Set());
  const poolKeysRef = useRef<Set<string>>(new Set());
  const topCardRef = useRef<SwipeCardHandle>(null);

  const loadMore = useCallback(async () => {
    setIsLoadingMore(true);
    try {
      if (genresRef.current.length === 0) {
        const genres = await fetchGenres();
        genresRef.current = dedupeGenres([...genres.movie, ...genres.tv]);
      }
      const genreList = genresRef.current;
      const genreId =
        rotationRef.current === 0
          ? undefined
          : genreList[(rotationRef.current - 1) % Math.max(genreList.length, 1)]?.id;
      rotationRef.current += 1;

      const batch = await fetchDiscoverBatch(genreId);
      const fresh = batch.filter((item) => {
        const k = keyOf(item);
        if (excludedRef.current.has(k) || poolKeysRef.current.has(k)) return false;
        poolKeysRef.current.add(k);
        return true;
      });
      setPool((prev) => [...prev, ...fresh]);
    } catch {
      // Swallow — the "no more titles" empty state below covers this case.
    } finally {
      setIsLoadingMore(false);
    }
  }, []);

  // Seed the exclude set from everything already swiped/added, then load the
  // first batch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const existing = await getWatchlist();
      if (cancelled) return;
      excludedRef.current = new Set(existing.map((r) => `${r.mediaType}:${r.titleId}`));
      loadMore();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refilling the pool is driven by the swipe action itself (an event), not
  // a reactive effect watching pool/index state — avoids a setState-in-effect
  // cascade for what is really just "fetch more when we're about to run out."
  async function handleSwiped(item: MediaItem, direction: SwipeDirection) {
    haptic();
    if (direction === "right") {
      await addToWatchlist(item, "want_to_watch");
      setLikedItems((prev) => [item, ...prev.filter((p) => keyOf(p) !== keyOf(item))].slice(0, MAX_SEEDS));
      setLikedCount((c) => c + 1);
    } else if (direction === "left") {
      await addToWatchlist(item, "not_interested");
      setDislikedCount((c) => c + 1);
    }
    // "up" = skip / haven't seen it: no persistence, just move on.
    excludedRef.current.add(keyOf(item));
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    if (pool.length - nextIndex <= REFILL_THRESHOLD && !isLoadingMore) {
      loadMore();
    }
  }

  async function loadForYou() {
    setMode("foryou");
    setRecsLoading(true);
    setRecsError(false);
    try {
      const data = await fetchRecommendations(likedItems);
      setRecs(data.results);
    } catch {
      setRecsError(true);
    } finally {
      setRecsLoading(false);
    }
  }

  const visible = pool.slice(currentIndex, currentIndex + 3);
  const deckExhausted = visible.length === 0 && !isLoadingMore;

  return (
    <View className="flex-1 bg-canvas">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 16, flexGrow: 1 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="gap-1 py-2">
          <Text className="text-white text-2xl font-bold">Swipe</Text>
          <Text className="text-ink-secondary text-sm">
            Swipe right to like, left to pass, up if you haven&apos;t seen it
          </Text>
        </View>

        <View className="flex-row rounded-xl bg-panel-raised p-1 gap-1">
          <Pressable
            onPress={() => setMode("swipe")}
            className={`flex-1 items-center justify-center rounded-lg py-2 ${
              mode === "swipe" ? "bg-accent" : ""
            }`}
          >
            <Text className={mode === "swipe" ? "text-white font-semibold" : "text-ink-secondary"}>
              Swipe
            </Text>
          </Pressable>
          <Pressable
            onPress={loadForYou}
            disabled={likedItems.length === 0}
            className={`flex-1 items-center justify-center rounded-lg py-2 ${
              mode === "foryou" ? "bg-accent" : ""
            } ${likedItems.length === 0 ? "opacity-40" : ""}`}
          >
            <Text className={mode === "foryou" ? "text-white font-semibold" : "text-ink-secondary"}>
              For You ({likedItems.length})
            </Text>
          </Pressable>
        </View>

        <View className="flex-row justify-center gap-6">
          <Text className="text-success text-xs font-semibold">{likedCount} liked</Text>
          <Text className="text-ink-secondary text-xs font-semibold">{dislikedCount} passed</Text>
        </View>

        {mode === "swipe" ? (
          <>
            <View style={{ height: 520 }} className="relative">
              {deckExhausted ? (
                <Panel className="flex-1 items-center justify-center gap-2 p-8">
                  <Text className="text-white text-base font-semibold">You&apos;re all caught up</Text>
                  <Text className="text-ink-secondary text-sm text-center">
                    No more titles to show right now — check back later or browse the home tab.
                  </Text>
                </Panel>
              ) : (
                visible
                  .map((item, i) => (
                    <SwipeCard
                      key={keyOf(item)}
                      ref={i === 0 ? topCardRef : undefined}
                      item={item}
                      isTop={i === 0}
                      stackOffset={i}
                      onSwiped={(direction) => handleSwiped(item, direction)}
                    />
                  ))
                  .reverse()
              )}
              {isLoadingMore && visible.length === 0 && (
                <View className="flex-1 items-center justify-center">
                  <ActivityIndicator color="#E50914" size="large" />
                </View>
              )}
            </View>

            {!deckExhausted && (
              <View className="flex-row justify-center gap-6 py-2">
                <Pressable
                  onPress={() => topCardRef.current?.swipe("left")}
                  className="h-14 w-14 items-center justify-center rounded-full bg-panel-raised border border-border"
                >
                  <Text className="text-accent text-2xl">&times;</Text>
                </Pressable>
                <Pressable
                  onPress={() => topCardRef.current?.swipe("up")}
                  className="h-14 w-14 items-center justify-center rounded-full bg-panel-raised border border-border"
                >
                  <Text className="text-ink-secondary text-lg font-bold">?</Text>
                </Pressable>
                <Pressable
                  onPress={() => topCardRef.current?.swipe("right")}
                  className="h-14 w-14 items-center justify-center rounded-full bg-panel-raised border border-border"
                >
                  <Text className="text-success text-2xl">&hearts;</Text>
                </Pressable>
              </View>
            )}
          </>
        ) : (
          <View className="gap-3">
            <SectionLabel>
              Based on what you liked: {likedItems.map((s) => s.title).join(", ")}
            </SectionLabel>
            <TitleGrid
              items={recs ?? []}
              isLoading={recsLoading}
              isError={recsError}
              errorMessage="Couldn't load recommendations. Try again in a moment."
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
