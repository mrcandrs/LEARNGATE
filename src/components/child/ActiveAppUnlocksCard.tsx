import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Card, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ChildProfileRow } from "@/types/child";
import { unlockDurationLabel } from "@/constants/appUnlock";
import { useAppColors } from "@/theme/useAppColors";
import { radii, shadows } from "@/theme/theme";
import { activeUnlocksForDisplay, formatUnlockRemaining, unlockRowForPackage } from "@/utils/appUnlockTime";
import { packagesForUnlockKey } from "@/utils/appUnlockPackages";
import { launchAppPackage } from "@/services/appBlocking";
import { ensurePackageAllowedOnNative, flushTempUnlocksToNative } from "@/services/appUnlockNativeSync";

type Props = {
  child: ChildProfileRow | null | undefined;
};

export function ActiveAppUnlocksCard({ child }: Props) {
  const c = useAppColors();
  const [tick, setTick] = useState(0);

  const unlocks = useMemo(
    () => activeUnlocksForDisplay(child?.blocked_apps_json ?? [], child?.temp_unlocks ?? []),
    [child?.blocked_apps_json, child?.temp_unlocks]
  );

  useEffect(() => {
    if (unlocks.length === 0) {
      return;
    }
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [unlocks.length]);

  if (unlocks.length === 0) {
    return null;
  }

  const nowMs = Date.now();

  return (
    <Card style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
      <Card.Content style={styles.content}>
        <View style={styles.header}>
          <MaterialCommunityIcons name="lock-open-variant" size={22} color={c.primary} />
          <Text variant="titleMedium" style={{ color: c.primaryDark, fontWeight: "800" }}>
            Unlocked apps
          </Text>
        </View>
        <Text variant="bodySmall" style={{ color: c.subtext }}>
          Parent-approved time left on blocked apps. Timer updates every second.
        </Text>
        {unlocks.map((item) => (
          <Pressable
            key={item.key}
            style={[styles.row, { borderColor: c.border }]}
            onPress={() => {
              const pkg = packagesForUnlockKey(item.key)[0];
              const row = unlockRowForPackage(pkg, child?.temp_unlocks ?? []);
              if (row) {
                void ensurePackageAllowedOnNative(
                  pkg,
                  row,
                  child?.temp_unlocks ?? [],
                  child?.blocked_apps_json ?? []
                ).then(() => launchAppPackage(pkg, row, child?.blocked_apps_json ?? []));
              } else {
                void flushTempUnlocksToNative().then(() => launchAppPackage(pkg));
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.label}`}
          >
            <MaterialCommunityIcons name={item.icon} size={24} color={c.primaryDark} />
            <View style={styles.rowText}>
              <Text style={{ color: c.text, fontWeight: "700" }}>{item.label}</Text>
              <Text variant="bodySmall" style={{ color: c.subtext }}>
                {item.duration ? unlockDurationLabel(item.duration) : "Unlocked"}
              </Text>
              <Text variant="bodySmall" style={{ color: c.primary }}>
                {formatUnlockRemaining(item, nowMs)}
              </Text>
            </View>
          </Pressable>
        ))}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    ...shadows.card,
  },
  content: {
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
});
