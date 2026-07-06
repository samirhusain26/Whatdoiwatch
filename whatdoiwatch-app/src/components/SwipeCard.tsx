// Tinder-style swipe card. Built on react-native-gesture-handler +
// react-native-reanimated (already app dependencies) rather than core RN
// Animated/PanResponder: this repo has React Compiler enabled
// (app.json experiments.reactCompiler), and the compiler's lint rules flag
// reading classic Animated.Value properties during render as "accessing
// refs during render". Reanimated's useSharedValue/useAnimatedStyle are the
// compiler-safe equivalent and are what react-native-worklets is already
// installed for.

import { forwardRef, useImperativeHandle } from "react";
import { Dimensions, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import type { MediaItem } from "@/lib/media";

export type SwipeDirection = "left" | "right" | "up";

export interface SwipeCardHandle {
  swipe: (direction: SwipeDirection) => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;
const SWIPE_UP_THRESHOLD = 120;
const OUT_DURATION = 220;

interface SwipeCardProps {
  item: MediaItem;
  onSwiped: (direction: SwipeDirection) => void;
  isTop: boolean;
  stackOffset: number;
}

function SwipeCard(
  { item, onSwiped, isTop, stackOffset }: SwipeCardProps,
  ref: React.Ref<SwipeCardHandle>
) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  function triggerSwipe(direction: SwipeDirection) {
    "worklet";
    const targetX =
      direction === "right" ? SCREEN_WIDTH * 1.5 : direction === "left" ? -SCREEN_WIDTH * 1.5 : 0;
    const targetY = direction === "up" ? -SCREEN_HEIGHT : 0;
    translateX.value = withTiming(targetX, { duration: OUT_DURATION });
    translateY.value = withTiming(targetY, { duration: OUT_DURATION }, (finished) => {
      if (finished) runOnJS(onSwiped)(direction);
    });
  }

  useImperativeHandle(ref, () => ({ swipe: triggerSwipe }));

  // Mutating .value on a Reanimated shared value is the sanctioned way to
  // drive UI-thread animation, not a render-time mutation — the React
  // Compiler eslint plugin doesn't yet special-case Reanimated the way it
  // does useRef, hence the disables below.
  const pan = Gesture.Pan()
    .enabled(isTop)
    .onUpdate((e) => {
      "worklet";
      // eslint-disable-next-line react-hooks/immutability
      translateX.value = e.translationX;
      // eslint-disable-next-line react-hooks/immutability
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      "worklet";
      if (e.translationX > SWIPE_THRESHOLD) {
        triggerSwipe("right");
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        triggerSwipe("left");
      } else if (e.translationY < -SWIPE_UP_THRESHOLD) {
        triggerSwipe("up");
      } else {
        // eslint-disable-next-line react-hooks/immutability
        translateX.value = withSpring(0);
        // eslint-disable-next-line react-hooks/immutability
        translateY.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    if (!isTop) {
      return {
        transform: [{ scale: 1 - stackOffset * 0.04 }, { translateY: stackOffset * 10 }],
      };
    }
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [-12, 0, 12]
    );
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const likeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [20, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));
  const nopeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, -20], [1, 0], Extrapolation.CLAMP),
  }));
  const skipStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [-SWIPE_UP_THRESHOLD, -20], [1, 0], Extrapolation.CLAMP),
  }));

  const isTv = item.media_type === "tv";
  const card = (
    <Animated.View
      style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, cardStyle]}
    >
      <View className="flex-1 rounded-2xl bg-tile border border-border-tile overflow-hidden">
        {item.poster ? (
          <Image
            source={{ uri: item.poster }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View className="flex-1 items-center justify-center bg-tile-deep px-6">
            <Text className="text-ink-secondary text-base text-center">{item.title}</Text>
          </View>
        )}

        {/* Bottom gradient with title strip */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.72)"]}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: 16,
            paddingTop: 40,
          }}
        >
          <View className="flex-row items-center gap-2">
            {isTv && (
              <View className="rounded bg-panel-raised px-1.5 py-0.5">
                <Text className="text-white text-[10px] font-bold uppercase">TV</Text>
              </View>
            )}
            <Text className="text-white text-lg font-bold flex-1" numberOfLines={1}>
              {item.title}
            </Text>
          </View>
          {item.year && <Text className="text-ink-secondary text-sm">{item.year}</Text>}
          {item.overview && (
            <Text className="text-white/80 text-xs mt-1" numberOfLines={3}>
              {item.overview}
            </Text>
          )}
        </LinearGradient>

        {isTop && (
          <>
            <Animated.View
              style={likeStyle}
              className="absolute top-6 left-6 rounded-lg border-4 border-success px-3 py-1 -rotate-12"
            >
              <Text className="text-success text-2xl font-extrabold">LIKE</Text>
            </Animated.View>
            <Animated.View
              style={nopeStyle}
              className="absolute top-6 right-6 rounded-lg border-4 border-accent px-3 py-1 rotate-12"
            >
              <Text className="text-accent text-2xl font-extrabold">NOPE</Text>
            </Animated.View>
            <Animated.View
              style={skipStyle}
              className="absolute top-6 self-center rounded-lg border-4 border-ink-secondary px-3 py-1"
            >
              <Text className="text-ink-secondary text-2xl font-extrabold">SKIP</Text>
            </Animated.View>
          </>
        )}
      </View>
    </Animated.View>
  );

  return isTop ? <GestureDetector gesture={pan}>{card}</GestureDetector> : card;
}

export default forwardRef(SwipeCard);
