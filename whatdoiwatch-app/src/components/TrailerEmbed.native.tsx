import { View } from "react-native";
import YoutubePlayer from "react-native-youtube-iframe";

interface TrailerEmbedProps {
  trailerKey: string;
}

export default function TrailerEmbed({ trailerKey }: TrailerEmbedProps) {
  return (
    <View className="rounded-xl overflow-hidden bg-tile-deep">
      <YoutubePlayer height={220} videoId={trailerKey} play={false} />
    </View>
  );
}
