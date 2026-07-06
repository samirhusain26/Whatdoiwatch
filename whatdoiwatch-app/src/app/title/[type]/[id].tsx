import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import type { MediaType, TitleDetailResponse } from "@/lib/media";
import { resolveRegion } from "@/lib/region";
import TitleDetailSheet, { type WatchlistAction } from "@/components/TitleDetailSheet";
import {
  addToWatchlist,
  getStatus,
  removeFromWatchlist,
  type WatchlistStatus,
} from "@/lib/db/watchlist-queries";

function deviceRegion(): string {
  if (typeof navigator !== "undefined" && navigator.language) {
    const parts = navigator.language.split("-");
    if (parts.length > 1) return resolveRegion(parts[1]);
  }
  return resolveRegion(null);
}

async function fetchTitleDetail(type: MediaType, id: string): Promise<TitleDetailResponse> {
  const region = deviceRegion();
  const res = await fetch(`/api/title/${type}/${id}?region=${encodeURIComponent(region)}`);
  if (!res.ok) throw new Error(`title detail failed: ${res.status}`);
  return res.json();
}

export default function TitleDetailRoute() {
  const params = useLocalSearchParams<{ type: string; id: string }>();
  const type = params.type === "tv" ? "tv" : "movie";
  const id = params.id ?? "";

  const detailQuery = useQuery({
    queryKey: ["title", type, id],
    queryFn: () => fetchTitleDetail(type, id),
    enabled: Boolean(id),
  });

  const [status, setStatus] = useState<WatchlistStatus | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!id) return;
    const current = await getStatus(type, Number(id));
    setStatus(current);
  }, [type, id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshStatus();
  }, [refreshStatus]);

  async function handleAction(action: WatchlistAction) {
    const detail = detailQuery.data?.title;
    if (!detail) return;
    const numericId = Number(id);

    if (Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (status === action) {
      // Tapping the active action again clears it.
      await removeFromWatchlist(type, numericId);
      setStatus(null);
      return;
    }

    await addToWatchlist(
      { media_type: type, id: numericId, title: detail.title, poster: detail.poster },
      action
    );
    setStatus(action);
  }

  return (
    <View className="flex-1 bg-canvas">
      <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
        <Text className="text-white text-lg font-bold">Details</Text>
        <Pressable
          onPress={() => router.back()}
          className="h-8 w-8 items-center justify-center rounded-full bg-panel-raised border border-border"
        >
          <Text className="text-white text-base leading-none">&times;</Text>
        </Pressable>
      </View>
      <TitleDetailSheet
        detail={detailQuery.data?.title}
        isLoading={detailQuery.isLoading}
        isError={detailQuery.isError}
        currentStatus={status}
        onAction={handleAction}
      />
    </View>
  );
}
