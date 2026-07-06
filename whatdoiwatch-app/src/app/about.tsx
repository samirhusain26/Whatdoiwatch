import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { Panel } from "@/components/ui";

export default function AboutScreen() {
  return (
    <View className="flex-1 bg-canvas">
      <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
        <Text className="text-white text-lg font-bold">About</Text>
        <Pressable
          onPress={() => router.back()}
          className="h-8 w-8 items-center justify-center rounded-full bg-panel-raised border border-border"
        >
          <Text className="text-white text-base leading-none">&times;</Text>
        </Pressable>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 16 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <Panel className="p-4 gap-2">
          <Text className="text-white text-sm font-semibold">The Movie Database (TMDB)</Text>
          <Text className="text-ink-secondary text-xs leading-5">
            This product uses the TMDB API but is not endorsed or certified by TMDB. Movie and TV
            metadata, artwork, and recommendations are sourced from TMDB.
          </Text>
        </Panel>

        <Panel className="p-4 gap-2">
          <Text className="text-white text-sm font-semibold">JustWatch</Text>
          <Text className="text-ink-secondary text-xs leading-5">
            Streaming availability (&quot;where to watch&quot;) is powered by JustWatch via TMDB&apos;s watch
            providers data.
          </Text>
        </Panel>

        <Panel className="p-4 gap-2">
          <Text className="text-white text-sm font-semibold">Watchmode</Text>
          <Text className="text-ink-secondary text-xs leading-5">
            IMDb ratings shown on title detail pages are provided by Watchmode.
          </Text>
        </Panel>

        <Panel className="p-4 gap-2">
          <Text className="text-white text-sm font-semibold">Privacy</Text>
          <Text className="text-ink-secondary text-xs leading-5">
            What Do I Watch uses an anonymous, on-device identifier only — no account, no
            tracking, no personal data collection. Your watchlist and preferences are stored
            locally on your device.
          </Text>
        </Panel>
      </ScrollView>
    </View>
  );
}
