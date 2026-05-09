import { PropsWithChildren } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "react-native-paper";

type ScreenContainerProps = PropsWithChildren<{
  scroll?: boolean;
  /** Horizontal padding (default 16). Use 0 for full-bleed headers. */
  contentPadding?: number;
  includeTopInset?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}>;

export function ScreenContainer({
  children,
  scroll = false,
  contentPadding = 16,
  includeTopInset = true,
  onRefresh,
  refreshing = false,
}: ScreenContainerProps) {
  const theme = useTheme();
  const pad = { paddingHorizontal: contentPadding, paddingBottom: 32, paddingTop: contentPadding, gap: 12 };
  const edges = includeTopInset ? (["top", "left", "right", "bottom"] as const) : (["left", "right", "bottom"] as const);

  if (scroll) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={edges}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, pad]}
          refreshControl={
            onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} /> : undefined
          }
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={edges}>
      <View style={[styles.content, { padding: contentPadding }]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
