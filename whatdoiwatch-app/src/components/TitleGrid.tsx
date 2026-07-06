import { Text, useWindowDimensions, View } from "react-native";

import type { MediaItem } from "@/lib/media";
import TitleCard, { TitleCardSkeleton } from "@/components/TitleCard";
import { Panel } from "@/components/ui";

function useColumnCount(): number {
  const { width } = useWindowDimensions();
  if (width >= 1200) return 5;
  if (width >= 900) return 4;
  if (width >= 640) return 3;
  return 2;
}

interface TitleGridProps {
  items: MediaItem[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
}

export default function TitleGrid({ items, isLoading, isError, errorMessage }: TitleGridProps) {
  const columns = useColumnCount();

  if (isError) {
    return (
      <Panel className="p-6 items-center gap-2">
        <Text className="text-warning text-base font-semibold">
          Something went wrong
        </Text>
        <Text className="text-ink-secondary text-sm text-center">
          {errorMessage ?? "We couldn't reach the server. Please try again in a moment."}
        </Text>
      </Panel>
    );
  }

  if (isLoading) {
    return (
      <View className="flex-row flex-wrap gap-4">
        {Array.from({ length: columns * 2 }).map((_, i) => (
          <View key={i} style={{ width: `${100 / columns}%` }} className="px-1">
            <TitleCardSkeleton />
          </View>
        ))}
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <Panel className="p-6 items-center gap-2">
        <Text className="text-white text-base font-semibold">No results yet</Text>
        <Text className="text-ink-secondary text-sm text-center">
          Try adjusting your filters or searching for a title you like.
        </Text>
      </Panel>
    );
  }

  return (
    <View className="flex-row flex-wrap gap-y-4">
      {items.map((item) => (
        <View
          key={`${item.media_type}:${item.id}`}
          style={{ width: `${100 / columns}%` }}
          className="px-1"
        >
          <TitleCard item={item} />
        </View>
      ))}
    </View>
  );
}
