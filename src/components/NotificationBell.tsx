import { useCallback, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useInAppNotifications } from "@/hooks/useInAppNotifications";
import { useAppColors } from "@/theme/useAppColors";
import { radii } from "@/theme/theme";
import { navigateFromNotification } from "@/navigation/navigationRef";
import type { UserNotification } from "@/services/inAppNotifications";

type Props = {
  enabled: boolean;
  /** White icon on primary header (parent tabs). */
  variant?: "header" | "dashboard";
};

function formatWhen(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function iconForKind(kind: string): keyof typeof MaterialCommunityIcons.glyphMap {
  switch (kind) {
    case "task_assigned":
      return "clipboard-plus-outline";
    case "task_submitted":
      return "clipboard-check-outline";
    case "task_completed":
      return "check-circle-outline";
    case "chore_approved":
      return "star-check-outline";
    case "child_game_milestone":
      return "gamepad-variant-outline";
    case "child_app_uninstalled":
      return "cellphone-off";
    case "child_device_offline":
      return "wifi-off";
    case "parent_insight":
      return "lightbulb-on-outline";
    default:
      return "bell-outline";
  }
}

export function NotificationBell({ enabled, variant = "header" }: Props) {
  const c = useAppColors();
  const { items, loading, unreadCount, refresh, markRead, markAllRead } = useInAppNotifications(enabled);
  const [open, setOpen] = useState(false);

  const iconColor = "#FFFFFF";

  const onOpen = useCallback(() => {
    setOpen(true);
    void refresh();
  }, [refresh]);

  const onPressItem = useCallback(
    async (item: UserNotification) => {
      await markRead(item.id);
      setOpen(false);
      navigateFromNotification(item.kind, item.data);
    },
    [markRead]
  );

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        onPress={onOpen}
        hitSlop={8}
        style={[styles.bellBtn, variant === "dashboard" && styles.bellBtnDashboard]}
      >
        <MaterialCommunityIcons name="bell-outline" size={24} color={iconColor} />
        {unreadCount > 0 ? (
          <View style={[styles.badge, { backgroundColor: c.warning }]}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
          </View>
        ) : null}
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.card }]} onPress={() => {}}>
            <View style={[styles.sheetHeader, { borderBottomColor: c.border }]}>
              <Text variant="titleLarge" style={{ color: c.text, fontWeight: "700" }}>
                Notifications
              </Text>
              <View style={styles.sheetActions}>
                {unreadCount > 0 ? (
                  <Pressable onPress={() => void markAllRead()} hitSlop={8}>
                    <Text style={{ color: c.primary, fontWeight: "600" }}>Mark all read</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                  <MaterialCommunityIcons name="close" size={24} color={c.subtext} />
                </Pressable>
              </View>
            </View>

            {loading && items.length === 0 ? (
              <View style={styles.centered}>
                <ActivityIndicator color={c.primary} />
              </View>
            ) : items.length === 0 ? (
              <View style={styles.centered}>
                <MaterialCommunityIcons name="bell-off-outline" size={40} color={c.subtext} />
                <Text style={{ color: c.subtext, marginTop: 8 }}>No notifications yet.</Text>
              </View>
            ) : (
              <FlatList
                data={items}
                keyExtractor={(item) => String(item.id)}
                refreshing={loading}
                onRefresh={() => void refresh()}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => {
                  const unread = !item.read_at;
                  return (
                    <Pressable
                      onPress={() => void onPressItem(item)}
                      style={[
                        styles.row,
                        { borderBottomColor: c.border },
                        unread && { backgroundColor: c.surfaceTint },
                      ]}
                    >
                      <View style={[styles.rowIcon, { backgroundColor: c.sectionIconBg }]}>
                        <MaterialCommunityIcons
                          name={iconForKind(item.kind)}
                          size={22}
                          color={c.primaryDark}
                        />
                      </View>
                      <View style={styles.rowBody}>
                        <View style={styles.rowTop}>
                          <Text
                            variant="titleSmall"
                            style={{ color: c.text, fontWeight: unread ? "700" : "600", flex: 1 }}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                          <Text variant="labelSmall" style={{ color: c.subtext }}>
                            {formatWhen(item.created_at)}
                          </Text>
                        </View>
                        <Text variant="bodySmall" style={{ color: c.subtext }} numberOfLines={2}>
                          {item.body}
                        </Text>
                      </View>
                      {unread ? <View style={[styles.unreadDot, { backgroundColor: c.primary }]} /> : null}
                    </Pressable>
                  );
                }}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellBtn: {
    marginRight: 4,
    padding: 4,
    position: "relative",
  },
  bellBtnDashboard: {
    marginRight: 0,
  },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "78%",
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    overflow: "hidden",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  listContent: {
    paddingBottom: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
});
