import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { Button, Dialog, Portal, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppColors } from "@/theme/useAppColors";
import { fetchTaskAuditTrail, formatWhen, type TaskAuditRow, type TaskAuditEvent } from "@/services/taskAuditTrail";
import { radii } from "@/theme/theme";
import { formatAppError } from "@/utils/errors";

type Props = {
  task: TaskAuditRow | null;
  visible: boolean;
  onDismiss: () => void;
};

export function ChildTaskAuditDialog({ task, visible, onDismiss }: Props) {
  const c = useAppColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const [events, setEvents] = useState<TaskAuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !task) {
      setEvents([]);
      setError(null);
      return;
    }
    let active = true;
    setLoading(true);
    void fetchTaskAuditTrail(task).then((rows) => {
      if (!active) return;
      setEvents(rows);
      setLoading(false);
    }).catch((err) => {
      if (!active) return;
      setError(formatAppError(err));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [visible, task?.id]);

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title style={{ color: c.text }}>{task?.title ?? "Task history"}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {loading ? <ActivityIndicator color={c.primary} /> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {!loading && !error && events.length === 0 ? (
              <Text style={{ color: c.subtext }}>No history recorded yet.</Text>
            ) : null}
            {events.map((event, index) => (
              <View key={`${event.at}-${event.title}-${index}`} style={styles.eventRow}>
                <View style={[styles.dot, { backgroundColor: c.primary }]} />
                <View style={styles.eventBody}>
                  <Text variant="titleSmall" style={{ color: c.text, fontWeight: "700" }}>
                    {event.title}
                  </Text>
                  <Text variant="bodySmall" style={{ color: c.subtext }}>
                    {formatWhen(event.at)}
                  </Text>
                  {event.detail ? (
                    <Text variant="bodySmall" style={{ color: c.text, marginTop: 4 }}>
                      {event.detail}
                    </Text>
                  ) : null}
                </View>
                <MaterialCommunityIcons name="history" size={18} color={c.subtext} />
              </View>
            ))}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss} textColor={c.primary}>
            Close
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

function createStyles(c: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    dialog: { backgroundColor: c.card, maxHeight: "80%" },
    scrollArea: { paddingHorizontal: 8, maxHeight: 360 },
    scrollContent: { paddingVertical: 8, gap: 12 },
    eventRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      padding: 12,
      borderRadius: radii.md,
      backgroundColor: c.mutedSurface,
      borderWidth: 1,
      borderColor: c.border,
    },
    dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
    eventBody: { flex: 1 },
    error: { color: "#B91C1C" },
  });
}
