import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Card, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { ParentSectionHeader } from "@/components/parent/ParentSectionHeader";
import { iconForPackage, labelForPackage } from "@/constants/blockedAppPackages";
import type { UnlockDuration } from "@/constants/appUnlock";
import { unlockDurationLabel } from "@/constants/appUnlock";
import { fetchActiveUnlocksForChildren, type ChildActiveUnlock } from "@/services/appUnlock";
import { effectiveUnlockEndMs, formatUnlockRemaining, isUnlockActive } from "@/utils/appUnlockTime";
import { unlockPricingKey } from "@/utils/appUnlockPackages";
import { useAppColors } from "@/theme/useAppColors";
import { radii, shadows } from "@/theme/theme";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type Props = {
  children: { id: string; name: string }[];
};

type GroupedUnlock = {
  key: string;
  label: string;
  icon: IconName;
  endMs: number;
  duration: UnlockDuration | null;
  started_at: string | null;
};

type ChildUnlockGroup = {
  childId: string;
  childName: string;
  items: GroupedUnlock[];
};

function groupUnlocks(rows: ChildActiveUnlock[], nowMs: number): Map<string, GroupedUnlock[]> {
  const byChild = new Map<string, Map<string, GroupedUnlock>>();

  for (const row of rows) {
    // Only show passes the child has actually started; granted-but-not-opened ones aren't "in use".
    if (!isUnlockActive(row, nowMs)) {
      continue;
    }
    const endMs = effectiveUnlockEndMs(row, nowMs);
    const groupKey = unlockPricingKey(row.package_name);
    let childMap = byChild.get(row.child_id);
    if (!childMap) {
      childMap = new Map<string, GroupedUnlock>();
      byChild.set(row.child_id, childMap);
    }
    const existing = childMap.get(groupKey);
    if (!existing || endMs > existing.endMs) {
      childMap.set(groupKey, {
        key: groupKey,
        label: labelForPackage(row.package_name),
        icon: iconForPackage(row.package_name) as IconName,
        endMs,
        duration: row.duration,
        started_at: row.started_at,
      });
    }
  }

  const out = new Map<string, GroupedUnlock[]>();
  for (const [childId, map] of byChild) {
    out.set(
      childId,
      [...map.values()].sort((a, b) => a.endMs - b.endMs)
    );
  }
  return out;
}

export function ParentActiveUnlocksCard({ children }: Props) {
  const c = useAppColors();
  const [rows, setRows] = useState<ChildActiveUnlock[]>([]);
  const [tick, setTick] = useState(0);

  const childIds = useMemo(() => children.map((child) => child.id), [children]);
  const childIdsKey = childIds.join(",");

  const load = useCallback(async () => {
    if (childIds.length === 0) {
      setRows([]);
      return;
    }
    const data = await fetchActiveUnlocksForChildren(childIds);
    setRows(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childIdsKey]);

  useFocusEffect(
    useCallback(() => {
      void load();
      const refresh = setInterval(() => void load(), 30_000);
      return () => clearInterval(refresh);
    }, [load])
  );

  const grouped = useMemo(() => groupUnlocks(rows, Date.now()), [rows, tick]);

  const activeGroups: ChildUnlockGroup[] = useMemo(() => {
    const list: ChildUnlockGroup[] = [];
    for (const child of children) {
      const items = grouped.get(child.id);
      if (items && items.length > 0) {
        list.push({ childId: child.id, childName: child.name, items });
      }
    }
    return list;
  }, [children, grouped]);

  useEffect(() => {
    if (rows.length === 0) {
      return;
    }
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [rows.length]);

  if (activeGroups.length === 0) {
    return null;
  }

  const nowMs = Date.now();

  return (
    <Card style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
      <Card.Content style={styles.content}>
        <ParentSectionHeader
          icon="lock-open-variant-outline"
          title="Currently unlocked apps"
          subtitle="Apps your children can use right now from approved star unlocks. Timers update live."
          style={styles.header}
        />

        {activeGroups.map((group) => (
          <View key={group.childId} style={styles.childBlock}>
            <Text variant="titleSmall" style={{ color: c.primaryDark, fontWeight: "800" }}>
              {group.childName}
            </Text>
            {group.items.map((item) => (
              <View key={`${group.childId}-${item.key}`} style={[styles.row, { borderColor: c.border }]}>
                <View style={[styles.iconWrap, { backgroundColor: c.surfaceTint }]}>
                  <MaterialCommunityIcons name={item.icon} size={24} color={c.primaryDark} />
                </View>
                <View style={styles.rowText}>
                  <Text style={{ color: c.text, fontWeight: "700" }} numberOfLines={1}>
                    {item.label}
                  </Text>
                  <Text variant="bodySmall" style={{ color: c.subtext }}>
                    {item.duration ? unlockDurationLabel(item.duration) : "Unlocked"}
                  </Text>
                </View>
                <Text variant="bodySmall" style={{ color: c.primary, fontWeight: "700" }}>
                  {formatUnlockRemaining(new Date(item.endMs).toISOString(), nowMs)}
                </Text>
              </View>
            ))}
          </View>
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
    gap: 12,
  },
  header: {
    marginBottom: 4,
  },
  childBlock: {
    gap: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
});
