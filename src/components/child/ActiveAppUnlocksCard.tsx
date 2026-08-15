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
import { activateAppUnlock, fetchChildTempUnlocks } from "@/services/appUnlock";
import { emitChildProfileRefresh } from "@/services/childProfileEvents";
import { ensurePackageAllowedOnNative, flushTempUnlocksToNative } from "@/services/appUnlockNativeSync";
import { useLocale } from "@/store/LocaleContext";

type Props = {
  child: ChildProfileRow | null | undefined;
};

export function ActiveAppUnlocksCard({ child }: Props) {
  const c = useAppColors();
  const { t } = useLocale();
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

  const openUnlock = async (key: string) => {
    const pkg = packagesForUnlockKey(key)[0];
    const childId = child?.id;
    // Start the clock now for fixed passes (no-op for anchored/already-started ones), then relaunch
    // with the fresh window so the child gets the full duration from this open.
    if (childId) {
      await activateAppUnlock(childId, pkg);
    }
    const freshRows = childId ? await fetchChildTempUnlocks(childId) : child?.temp_unlocks ?? [];
    const row = unlockRowForPackage(pkg, freshRows);
    if (row) {
      await ensurePackageAllowedOnNative(pkg, row, freshRows, child?.blocked_apps_json ?? []);
      await launchAppPackage(pkg, row, child?.blocked_apps_json ?? []);
    } else {
      await flushTempUnlocksToNative();
      await launchAppPackage(pkg);
    }
    emitChildProfileRefresh();
  };

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
            {t("child.unlocks.title")}
          </Text>
        </View>
        <Text variant="bodySmall" style={{ color: c.subtext }}>
          {t("child.unlocks.subtitle")}
        </Text>
        {unlocks.map((item) => (
          <Pressable
            key={item.key}
            style={[styles.row, { borderColor: c.border }]}
            onPress={() => void openUnlock(item.key)}
            accessibilityRole="button"
            accessibilityLabel={
              item.activated
                ? t("child.unlocks.openApp", { label: item.label })
                : t("child.unlocks.startAndOpen", { label: item.label })
            }
          >
            <MaterialCommunityIcons name={item.icon} size={24} color={c.primaryDark} />
            <View style={styles.rowText}>
              <Text style={{ color: c.text, fontWeight: "700" }}>{item.label}</Text>
              <Text variant="bodySmall" style={{ color: c.subtext }}>
                {item.duration ? unlockDurationLabel(item.duration) : t("child.unlocks.unlocked")}
              </Text>
              <Text variant="bodySmall" style={{ color: c.primary }}>
                {item.activated
                  ? formatUnlockRemaining(item.unlock_until, nowMs)
                  : item.duration
                    ? t("child.unlocks.tapToStartDuration", { duration: unlockDurationLabel(item.duration) })
                    : t("child.unlocks.tapToStart")}
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
