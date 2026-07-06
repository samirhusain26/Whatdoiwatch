import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";

import type { MediaItem } from "@/lib/media";

interface TitleCardProps {
  item: MediaItem;
}

export function TitleCardSkeleton() {
  return (
    <View className="flex-1 aspect-[2/3] rounded-2xl bg-tile border border-border-tile overflow-hidden">
      <View className="flex-1 bg-tile-deep animate-pulse" />
    </View>
  );
}

export default function TitleCard({ item }: TitleCardProps) {
  const [imageError, setImageError] = useState(false);
  const isTv = item.media_type === "tv";

  return (
    <Link href={`/title/${item.media_type}/${item.id}`} asChild>
      <Pressable className="flex-1 group">
        <View className="aspect-[2/3] rounded-2xl bg-tile border border-border-tile overflow-hidden relative">
          {item.poster && !imageError ? (
            <Image
              source={{ uri: item.poster }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              transition={150}
              onError={() => setImageError(true)}
            />
          ) : (
            <View className="flex-1 items-center justify-center bg-tile-deep px-2">
              <Text className="text-ink-secondary text-xs text-center">{item.title}</Text>
            </View>
          )}

          {/* Netflix gradient overlay — bottom third */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.64)"]}
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "40%",
              justifyContent: "flex-end",
              padding: 8,
            }}
          >
            {typeof item.vote_average === "number" && item.vote_average > 0 && (
              <Text className="text-accent text-xs font-bold">
                {item.vote_average.toFixed(1)}
              </Text>
            )}
          </LinearGradient>

          {isTv && (
            <View className="absolute top-2 right-2 rounded bg-panel-raised px-1.5 py-0.5">
              <Text className="text-white text-[10px] font-bold uppercase">TV</Text>
            </View>
          )}
        </View>
        <Text className="text-white text-sm mt-1.5 px-0.5" numberOfLines={2} style={{ fontWeight: "600" }}>
          {item.title}
        </Text>
        {item.year && <Text className="text-ink-tertiary text-xs px-0.5">{item.year}</Text>}
      </Pressable>
    </Link>
  );
}
