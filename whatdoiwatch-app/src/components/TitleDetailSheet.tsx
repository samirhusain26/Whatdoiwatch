import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";

import type { TitleDetail, WatchProvider } from "@/lib/media";
import TrailerEmbed from "@/components/TrailerEmbed";
import { SectionLabel } from "@/components/ui";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

function providerLogoUri(logoPath: string | null): string | null {
  if (!logoPath) return null;
  if (logoPath.startsWith("http")) return logoPath;
  return `${TMDB_IMAGE_BASE}/w92${logoPath}`;
}

function profileUri(profilePath: string | null | undefined): string | null {
  if (!profilePath) return null;
  if (profilePath.startsWith("http")) return profilePath;
  return `${TMDB_IMAGE_BASE}/w185${profilePath}`;
}

function ProviderRow({ label, providers }: { label: string; providers?: WatchProvider[] }) {
  if (!providers || providers.length === 0) return null;
  return (
    <View className="gap-2">
      <SectionLabel>{label}</SectionLabel>
      <View className="flex-row flex-wrap gap-2">
        {providers.map((p) => {
          const uri = providerLogoUri(p.logo_path);
          return (
            <View
              key={p.provider_id}
              className="flex-row items-center gap-2 rounded-lg bg-panel-raised border border-border px-2 py-1.5"
            >
              {uri ? (
                <Image source={{ uri }} style={{ width: 24, height: 24, borderRadius: 6 }} />
              ) : null}
              <Text className="text-white text-xs">{p.provider_name}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export type WatchlistAction = "want_to_watch" | "seen" | "not_interested";

interface TitleDetailSheetProps {
  detail?: TitleDetail;
  isLoading: boolean;
  isError: boolean;
  currentStatus?: WatchlistAction | null;
  onAction?: (action: WatchlistAction) => void;
}

const ACTIONS: { value: WatchlistAction; label: string }[] = [
  { value: "want_to_watch", label: "Want to Watch" },
  { value: "seen", label: "Seen It" },
  { value: "not_interested", label: "Not Interested" },
];

function actionColors(action: WatchlistAction): string {
  switch (action) {
    case "want_to_watch":
      return "bg-success border-success";
    case "seen":
      return "bg-accent border-accent";
    case "not_interested":
      return "bg-panel-raised border-border";
  }
}

export default function TitleDetailSheet({
  detail,
  isLoading,
  isError,
  currentStatus,
  onAction,
}: TitleDetailSheetProps) {
  const [posterError, setPosterError] = useState(false);
  const [backdropError, setBackdropError] = useState(false);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas p-8">
        <ActivityIndicator color="#E50914" size="large" />
      </View>
    );
  }

  if (isError || !detail) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas p-8 gap-2">
        <Text className="text-warning text-base font-semibold">Couldn&apos;t load details</Text>
        <Text className="text-ink-secondary text-sm text-center">
          This title may still be loading on the backend, or something went wrong. Try again in a
          moment.
        </Text>
      </View>
    );
  }

  const isTv = detail.media_type === "tv";
  const ratingIsImdb = detail.imdb_rating != null;
  const ratingValue = ratingIsImdb ? detail.imdb_rating : detail.vote_average ?? null;
  const hasBackdrop = detail.backdrop && !backdropError;

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ gap: 16 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      {/* Netflix backdrop hero */}
      {hasBackdrop ? (
        <View className="relative" style={{ aspectRatio: 16 / 9 }}>
          <Image
            source={{ uri: detail.backdrop! }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            onError={() => setBackdropError(true)}
          />
          {/* Gradient fade to black at bottom */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.6)", "#000000"]}
            locations={[0.3, 0.7, 1]}
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "60%",
            }}
          />
          {/* Overlapping poster + title */}
          <View
            className="absolute bottom-0 left-0 right-0 px-4 pb-2"
            style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}
          >
            <View className="w-24 aspect-[2/3] rounded-xl overflow-hidden bg-tile border border-border-tile">
              {detail.poster && !posterError ? (
                <Image
                  source={{ uri: detail.poster }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                  onError={() => setPosterError(true)}
                />
              ) : null}
            </View>
            <View className="flex-1 gap-1" style={{ paddingBottom: 4 }}>
              <Text className="text-white text-2xl font-bold" style={{ letterSpacing: -0.3 }}>
                {detail.title}
              </Text>
              <Text className="text-ink-secondary text-sm">
                {detail.year ?? "Unknown year"} · {isTv ? "TV Series" : "Movie"}
              </Text>
              {ratingValue != null && (
                <Text className="text-accent text-sm font-semibold">
                  {ratingIsImdb ? "IMDb" : "TMDB"} {ratingValue.toFixed(1)}/10
                </Text>
              )}
            </View>
          </View>
        </View>
      ) : (
        /* Fallback: side-by-side row when no backdrop */
        <View className="flex-row gap-4 px-4 pt-4">
          <View className="w-32 aspect-[2/3] rounded-xl overflow-hidden bg-tile border border-border-tile">
            {detail.poster && !posterError ? (
              <Image
                source={{ uri: detail.poster }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                onError={() => setPosterError(true)}
              />
            ) : (
              <View className="flex-1 items-center justify-center px-2">
                <Text className="text-ink-secondary text-xs text-center">{detail.title}</Text>
              </View>
            )}
          </View>

          <View className="flex-1 gap-1.5">
            <Text className="text-white text-2xl font-bold" style={{ letterSpacing: -0.3 }}>
              {detail.title}
            </Text>
            <Text className="text-ink-secondary text-sm">
              {detail.year ?? "Unknown year"} · {isTv ? "TV Series" : "Movie"}
            </Text>
            {ratingValue != null && (
              <Text className="text-accent text-sm font-semibold">
                {ratingIsImdb ? "IMDb" : "TMDB"} {ratingValue.toFixed(1)}/10
              </Text>
            )}
            {isTv && (detail.number_of_seasons || detail.number_of_episodes) && (
              <Text className="text-ink-tertiary text-xs">
                {detail.number_of_seasons ? `${detail.number_of_seasons} seasons` : ""}
                {detail.number_of_seasons && detail.number_of_episodes ? " · " : ""}
                {detail.number_of_episodes ? `${detail.number_of_episodes} episodes` : ""}
              </Text>
            )}
            {!isTv && detail.runtime ? (
              <Text className="text-ink-tertiary text-xs">{detail.runtime} min</Text>
            ) : null}
          </View>
        </View>
      )}

      {/* Content below the hero — padded */}
      <View style={{ paddingHorizontal: 16, gap: 16, paddingBottom: 16 }}>
        {/* Extra meta for backdrop variant */}
        {hasBackdrop && (
          <View className="gap-0.5">
            {isTv && (detail.number_of_seasons || detail.number_of_episodes) && (
              <Text className="text-ink-tertiary text-xs">
                {detail.number_of_seasons ? `${detail.number_of_seasons} seasons` : ""}
                {detail.number_of_seasons && detail.number_of_episodes ? " · " : ""}
                {detail.number_of_episodes ? `${detail.number_of_episodes} episodes` : ""}
              </Text>
            )}
            {!isTv && detail.runtime ? (
              <Text className="text-ink-tertiary text-xs">{detail.runtime} min</Text>
            ) : null}
          </View>
        )}

        {onAction && (
          <View className="flex-row flex-wrap gap-2">
            {ACTIONS.map((action) => {
              const active = currentStatus === action.value;
              return (
                <Pressable
                  key={action.value}
                  onPress={() => onAction(action.value)}
                  className={`rounded-full border px-3 py-2 ${
                    active
                      ? actionColors(action.value)
                      : "bg-panel-raised border-border"
                  }`}
                >
                  <Text className={active ? "text-white text-xs font-semibold" : "text-ink-secondary text-xs"}>
                    {active ? `✓ ${action.label}` : action.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {detail.overview ? (
          <View className="gap-1.5">
            <SectionLabel>Overview</SectionLabel>
            <Text className="text-white text-base leading-6" style={{ fontWeight: "400" }}>
              {detail.overview}
            </Text>
          </View>
        ) : null}

        {detail.cast && detail.cast.length > 0 && (
          <View className="gap-2">
            <SectionLabel>Cast</SectionLabel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-3 pr-2">
                {detail.cast.slice(0, 5).map((member) => {
                  const uri = profileUri(member.profile_path);
                  return (
                    <View key={member.id} className="items-center w-20 gap-1">
                      <View className="w-16 h-16 rounded-full overflow-hidden bg-panel-raised border border-border">
                        {uri ? (
                          <Image source={{ uri }} style={{ width: "100%", height: "100%" }} />
                        ) : null}
                      </View>
                      <Text className="text-white text-[11px] text-center" numberOfLines={2}>
                        {member.name}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        {(detail.providers?.flatrate?.length ||
          detail.providers?.rent?.length ||
          detail.providers?.buy?.length) ? (
          <View className="gap-3">
            {detail.providers.link ? (
              <Link href={detail.providers.link as never} asChild>
                <Pressable>
                  <ProviderRow label="Stream" providers={detail.providers.flatrate} />
                </Pressable>
              </Link>
            ) : (
              <ProviderRow label="Stream" providers={detail.providers.flatrate} />
            )}
            <ProviderRow label="Rent" providers={detail.providers.rent} />
            <ProviderRow label="Buy" providers={detail.providers.buy} />
          </View>
        ) : (
          <Text className="text-ink-tertiary text-xs">No streaming availability found for your region.</Text>
        )}

        {detail.trailer_key ? (
          <View className="gap-2">
            <SectionLabel>Trailer</SectionLabel>
            <TrailerEmbed trailerKey={detail.trailer_key} />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
