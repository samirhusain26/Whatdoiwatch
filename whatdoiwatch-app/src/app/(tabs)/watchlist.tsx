import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { Link, useFocusEffect } from "expo-router";

import {
  getWatchlist,
  removeFromWatchlist,
  updateStatus,
  type WatchlistRow,
  type WatchlistStatus,
} from "@/lib/db/watchlist-queries";
import { Panel } from "@/components/ui";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

const TABS: { value: WatchlistStatus; label: string }[] = [
  { value: "want_to_watch", label: "Want to Watch" },
  { value: "seen", label: "Seen" },
  { value: "not_interested", label: "Not Interested" },
];

const EMPTY_COPY: Record<WatchlistStatus, string> = {
  want_to_watch: "Add titles you want to watch from any detail page — they'll show up here.",
  seen: "Mark titles as seen and they'll show up here, and stop appearing in recommendations.",
  not_interested: "Titles you dismiss as not interested land here and are excluded from recs.",
};

function posterUri(posterPath: string | null): string | null {
  if (!posterPath) return null;
  if (posterPath.startsWith("http")) return posterPath;
  return `${TMDB_IMAGE_BASE}/w185${posterPath}`;
}

function WatchlistRowItem({
  row,
  onRemove,
  onChangeStatus,
}: {
  row: WatchlistRow;
  onRemove: (row: WatchlistRow) => void;
  onChangeStatus: (row: WatchlistRow, status: WatchlistStatus) => void;
}) {
  const uri = posterUri(row.posterPath);

  return (
    <View className="flex-row items-center gap-3 rounded-xl bg-panel border border-border p-3">
      <Link href={`/title/${row.mediaType}/${row.titleId}`} asChild>
        <Pressable className="flex-row items-center gap-3 flex-1">
          <View className="w-12 aspect-[2/3] rounded-lg overflow-hidden bg-panel-raised border border-border">
            {uri ? (
              <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            ) : null}
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-white text-sm font-semibold" numberOfLines={2}>
              {row.title}
            </Text>
            <Text className="text-ink-tertiary text-xs uppercase">
              {row.mediaType === "tv" ? "TV" : "Movie"}
            </Text>
          </View>
        </Pressable>
      </Link>

      <View className="flex-row items-center gap-2">
        {row.status !== "want_to_watch" && (
          <Pressable
            onPress={() => onChangeStatus(row, "want_to_watch")}
            className="h-8 w-8 items-center justify-center rounded-full bg-panel-raised border border-border"
          >
            <Text className="text-white text-xs">↺</Text>
          </Pressable>
        )}
        {row.status === "want_to_watch" && (
          <Pressable
            onPress={() => onChangeStatus(row, "seen")}
            className="h-8 w-8 items-center justify-center rounded-full bg-panel-raised border border-border"
          >
            <Text className="text-white text-xs">✓</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => onRemove(row)}
          className="h-8 w-8 items-center justify-center rounded-full bg-panel-raised border border-border"
        >
          <Text className="text-ink-secondary text-xs">✕</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function WatchlistScreen() {
  const [activeTab, setActiveTab] = useState<WatchlistStatus>("want_to_watch");
  const [rows, setRows] = useState<WatchlistRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getWatchlist(activeTab);
      setRows(data);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  // Reload whenever the tab changes and whenever this screen regains focus
  // (e.g. after the user marks a title from the detail screen).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleRemove(row: WatchlistRow) {
    setRows((prev) => prev.filter((r) => !(r.mediaType === row.mediaType && r.titleId === row.titleId)));
    await removeFromWatchlist(row.mediaType, row.titleId);
  }

  async function handleChangeStatus(row: WatchlistRow, status: WatchlistStatus) {
    setRows((prev) => prev.filter((r) => !(r.mediaType === row.mediaType && r.titleId === row.titleId)));
    await updateStatus(row.mediaType, row.titleId, status);
  }

  return (
    <View className="flex-1 bg-canvas">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 16 }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor="#E50914" />}
      >
        <View className="gap-1 py-2">
          <Text className="text-white text-2xl font-bold">Watchlist</Text>
          <Text className="text-ink-secondary text-sm">Titles you&apos;ve saved, seen, or dismissed</Text>
        </View>

        <View className="flex-row rounded-xl bg-panel-raised p-1 gap-1">
          {TABS.map((tab) => {
            const active = activeTab === tab.value;
            return (
              <Pressable
                key={tab.value}
                onPress={() => setActiveTab(tab.value)}
                className={`flex-1 items-center justify-center rounded-lg py-2 ${
                  active ? "bg-accent" : ""
                }`}
              >
                <Text
                  className={`text-xs text-center ${active ? "text-white font-semibold" : "text-ink-secondary"}`}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {isLoading ? (
          <View className="items-center justify-center py-12">
            <ActivityIndicator color="#E50914" size="large" />
          </View>
        ) : rows.length === 0 ? (
          <Panel className="p-8 items-center gap-2">
            <Text className="text-white text-base font-semibold">Nothing here yet</Text>
            <Text className="text-ink-secondary text-sm text-center">{EMPTY_COPY[activeTab]}</Text>
          </Panel>
        ) : (
          <View className="gap-3">
            {rows.map((row) => (
              <WatchlistRowItem
                key={`${row.mediaType}:${row.titleId}`}
                row={row}
                onRemove={handleRemove}
                onChangeStatus={handleChangeStatus}
              />
            ))}
          </View>
        )}

        <Link href="/about" asChild>
          <Pressable className="items-center py-2">
            <Text className="text-ink-tertiary text-xs">About &amp; Attributions</Text>
          </Pressable>
        </Link>
      </ScrollView>
    </View>
  );
}
