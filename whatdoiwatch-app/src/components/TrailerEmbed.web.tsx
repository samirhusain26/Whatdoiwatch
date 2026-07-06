import { View } from "react-native";

interface TrailerEmbedProps {
  trailerKey: string;
}

export default function TrailerEmbed({ trailerKey }: TrailerEmbedProps) {
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
