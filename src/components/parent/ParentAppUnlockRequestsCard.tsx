import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { StyleSheet, View } from "react-native";
import { Button, Card, Text, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { ParentSectionHeader } from "@/components/parent/ParentSectionHeader";
import { iconForPackage, labelForBlockedPackage } from "@/constants/blockedAppPackages";
import { unlockDurationLabel } from "@/constants/appUnlock";
import type { AppUnlockRequestRow } from "@/constants/appUnlock";
import { fetchPendingUnlockRequests, resolveAppUnlock } from "@/services/appUnlock";
import { useAppColors } from "@/theme/useAppColors";
import { radii, shadows } from "@/theme/theme";
import { useLocale } from "@/store/LocaleContext";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type Props = {
  childIds: string[];
  highlighted?: boolean;
  onResolved?: () => void;
};

function childNameFromRow(row: AppUnlockRequestRow, fallback: string): string {
  const joined = row.children;
  if (!joined) return fallback;
  if (Array.isArray(joined)) return joined[0]?.name ?? fallback;
  return joined.name ?? fallback;
}

export function ParentAppUnlockRequestsCard({ childIds, highlighted = false, onResolved }: Props) {
  const c = useAppColors();
  const { t } = useLocale();
  const theme = useTheme();
  const [requests, setRequests] = useState<AppUnlockRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const rows = await fetchPendingUnlockRequests(childIds);
    setRequests(rows);
    setLoading(false);
  }, [childIds]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleResolve = async (requestId: string, action: "approve" | "deny") => {
    setBusyId(requestId);
    const result = await resolveAppUnlock(requestId, action);
    setBusyId(null);
    if (result.ok) {
      await load();
      onResolved?.();
    }
  };

  if (loading || requests.length === 0) {
    return null;
  }

  return (
    <Card
      style={[
        styles.card,
        {
          borderColor: highlighted ? c.primary : c.border,
          backgroundColor: c.card,
          borderWidth: highlighted ? 2 : 1,
        },
      ]}
    >
      <Card.Content style={styles.content}>
        <ParentSectionHeader
          icon="star-circle-outline"
          title={t("parent.unlocks.requestsTitle")}
          subtitle={t("parent.unlocks.requestsSubtitle")}
          style={styles.header}
        />

        {requests.map((row) => {
          const label = row.app_label ?? labelForBlockedPackage(row.package_name);
          const icon = iconForPackage(row.package_name) as IconName;
          const childName = childNameFromRow(row, t("parent.submissions.child"));

          return (
            <View key={row.id} style={[styles.row, { borderColor: c.border }]}>
              <View style={[styles.iconWrap, { backgroundColor: c.surfaceTint }]}>
                <MaterialCommunityIcons name={icon} size={26} color={c.primaryDark} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.appName, { color: c.text }]} numberOfLines={1}>
                  {label}
                </Text>
                <Text variant="bodySmall" style={{ color: c.subtext }}>
                  {t("parent.unlocks.starsDuration", {
                    name: childName,
                    stars: row.stars_escrowed,
                    duration: unlockDurationLabel(row.duration),
                  })}
                </Text>
                {row.child_message ? (
                  <Text variant="bodySmall" style={[styles.note, { color: c.subtext }]}>
                    {t("parent.unlocks.noteFromChild", { note: row.child_message })}
                  </Text>
                ) : null}
              </View>
              <View style={styles.actions}>
                <Button
                  mode="contained-tonal"
                  compact
                  loading={busyId === row.id}
                  disabled={busyId != null}
                  onPress={() => void handleResolve(row.id, "approve")}
                >
                  {t("common.approve")}
                </Button>
                <Button
                  mode="text"
                  compact
                  textColor={theme.colors.error}
                  disabled={busyId != null}
                  onPress={() => void handleResolve(row.id, "deny")}
                >
                  {t("common.deny")}
                </Button>
              </View>
            </View>
          );
        })}
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
    gap: 12,
  },
  header: {
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  appName: {
    fontWeight: "700",
    fontSize: 15,
  },
  note: {
    fontStyle: "italic",
    marginTop: 2,
  },
  actions: {
    gap: 2,
    alignItems: "flex-end",
  },
});
