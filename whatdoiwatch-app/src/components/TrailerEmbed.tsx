// Platform-specific implementations live in TrailerEmbed.web.tsx and
// TrailerEmbed.native.tsx — Metro resolves those automatically per platform.
// This file exists only so TypeScript (which doesn't apply Metro's platform
// extension resolution) has a module to resolve against.
import { Platform, View } from "react-native";

interface TrailerEmbedProps {
  trailerKey: string;
}

export default function TrailerEmbed({ trailerKey }: TrailerEmbedProps) {
  if (Platform.OS === "web") {
    return (
      <View className="rounded-xl overflow-hidden aspect-video bg-tile-deep">
        {/* eslint-disable-next-line react/no-unknown-property */}
        <iframe
          src={`https://www.youtube.com/embed/${trailerKey}`}
          title="Trailer"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ width: "100%", height: "100%", border: "none" }}
        />
      </View>
    );
  }
  const YoutubePlayer = require("react-native-youtube-iframe").default;
  return (
    <View className="rounded-xl overflow-hidden bg-tile-deep">
      <YoutubePlayer height={220} videoId={trailerKey} play={false} />
    </View>
  );
}
