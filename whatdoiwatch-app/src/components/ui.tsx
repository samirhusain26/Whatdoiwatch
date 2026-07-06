import { Pressable, Text, View, type ViewProps, type PressableProps } from "react-native";

// ---- Panel ----
// Linear-style chrome surface: charcoal background, subtle border, 12px radius.

interface PanelProps extends ViewProps {
  children: React.ReactNode;
}

export function Panel({ children, className, ...props }: PanelProps) {
  return (
    <View className={`rounded-xl bg-panel border border-border ${className ?? ""}`} {...props}>
      {children}
    </View>
  );
}

// ---- Chip ----
// Pill toggle used for genres, eras, selected titles, badges.

interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
}

export function Chip({ label, active, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full border px-3 py-1.5 ${
        active
          ? "bg-accent border-accent"
          : "bg-panel-raised border-border"
      }`}
    >
      <Text
        className={
          active
            ? "text-white font-semibold text-sm"
            : "text-ink-secondary text-sm"
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ---- PrimaryButton ----
// Netflix-style red CTA: 4px radius, 48px min-height, white bold text.

interface PrimaryButtonProps extends Omit<PressableProps, "children"> {
  label: string;
}

export function PrimaryButton({ label, className, ...props }: PrimaryButtonProps) {
  return (
    <Pressable
      className={`rounded bg-accent py-4 items-center ${className ?? ""}`}
      {...props}
    >
      <Text className="text-white text-sm font-bold uppercase tracking-wider">
        {label}
      </Text>
    </Pressable>
  );
}

// ---- SectionLabel ----
// Linear-style tertiary uppercase label (OVERVIEW, CAST, STREAM, etc.).

interface SectionLabelProps {
  children: React.ReactNode;
}

export function SectionLabel({ children }: SectionLabelProps) {
  return (
    <Text className="text-ink-tertiary text-xs uppercase tracking-wide">
      {children}
    </Text>
  );
}
