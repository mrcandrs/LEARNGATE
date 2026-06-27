import { Image, Pressable, StyleSheet, View } from "react-native";
import { Menu, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { formatAppTimeShort, type ChildMonitor } from "@/services/parentDashboardAnalytics";
import { useAppColors } from "@/theme/useAppColors";
import type { AppColors } from "@/theme/theme";
import { radii, shadows } from "@/theme/theme";

export type LiveMonitorChildOption = {
  id: string;
  name: string;
  avatar_url: string | null;
};

type ParentLiveMonitoringCardProps = {
  monitor: ChildMonitor;
  childOptions: LiveMonitorChildOption[];
  selectedChildId: string;
  menuVisible: boolean;
  onOpenMenu: () => void;
  onDismissMenu: () => void;
  onSelectChild: (childId: string) => void;
};

export function ParentLiveMonitoringCard({
  monitor,
  childOptions,
  selectedChildId,
  menuVisible,
  onOpenMenu,
  onDismissMenu,
  onSelectChild,
}: ParentLiveMonitoringCardProps) {
  const c = useAppColors();
  const deviceLine = monitor.hasLinkedAccount
    ? `LearnGate app · ${monitor.lastSeenLabel}`
    : `PIN login · ${monitor.lastSeenLabel}`;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionTitle, { color: c.primaryDark }]}>Live Monitoring</Text>
      <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
        <View style={styles.profileRow}>
          <View style={[styles.avatarWrap, { backgroundColor: c.surfaceTint }]}>
            {childOptions.find((child) => child.id === selectedChildId)?.avatar_url ? (
              <Image
                source={{ uri: childOptions.find((child) => child.id === selectedChildId)!.avatar_url! }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: c.surfaceTintBorder }]}>
                <Text style={[styles.avatarLetter, { color: c.primaryDark }]}>
                  {monitor.childName.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.profileText}>
            <Text style={[styles.name, { color: c.primaryDark }]}>{monitor.childName}</Text>
            <Text style={[styles.device, { color: c.subtext }]}>{deviceLine}</Text>
          </View>
          <Menu
            visible={menuVisible}
            onDismiss={onDismissMenu}
            anchor={
              <Pressable
                onPress={onOpenMenu}
                style={[styles.childPill, { backgroundColor: c.surfaceTint, borderColor: c.surfaceTintBorder }]}
                accessibilityRole="button"
                accessibilityLabel="Select child to monitor"
              >
                <Text style={[styles.childPillText, { color: c.primaryDark }]} numberOfLines={1}>
                  {monitor.childName}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={18} color={c.primaryDark} />
              </Pressable>
            }
          >
            {childOptions.map((child) => (
              <Menu.Item
                key={child.id}
                title={child.name}
                onPress={() => {
                  onSelectChild(child.id);
                  onDismissMenu();
                }}
              />
            ))}
          </Menu>
        </View>

        <View style={[styles.statsRow, { borderTopColor: c.border }]}>
          <Stat value={String(monitor.taskCount)} label="Task" colors={c} />
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <Stat value={String(monitor.completedCount)} label="Completed" colors={c} />
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <Stat value={String(monitor.pendingCount)} label="Pending" colors={c} />
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <Stat value={formatAppTimeShort(monitor.appTimeSeconds)} label="App time" colors={c} />
        </View>
      </View>
    </View>
  );
}

function Stat({ value, label, colors: c }: { value: string; label: string; colors: AppColors }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: c.primaryDark }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: c.subtext }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 14,
    gap: 14,
    ...shadows.card,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: "hidden",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontSize: 20,
    fontWeight: "800",
  },
  profileText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  name: {
    fontSize: 17,
    fontWeight: "800",
  },
  device: {
    fontSize: 12,
  },
  childPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    maxWidth: 130,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  childPillText: {
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: 12,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 11,
    textAlign: "center",
  },
  divider: {
    width: 1,
    height: 32,
  },
});
