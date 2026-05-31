import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { useAppColors } from "@/theme/useAppColors";
import { DAILY_LIMIT_MAX_MINUTES, DAILY_LIMIT_MIN_MINUTES } from "@/utils/childLimits";
import { WheelPickerColumn, WHEEL_VISIBLE_HEIGHT } from "@/components/parent/WheelPickerColumn";
import { PickerModalSheet } from "@/components/parent/PickerModalSheet";

type Props = {
  visible: boolean;
  totalMinutes: number;
  title?: string;
  onDismiss: () => void;
  onConfirm: (totalMinutes: number) => void;
};

function clampMinutes(value: number): number {
  return Math.min(DAILY_LIMIT_MAX_MINUTES, Math.max(DAILY_LIMIT_MIN_MINUTES, value));
}

function splitMinutes(total: number) {
  const safe = clampMinutes(total);
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return { hours, minutes };
}

function combineMinutes(hours: number, minutes: number) {
  return clampMinutes(hours * 60 + minutes);
}

export function DurationPickerModal({ visible, totalMinutes, title = "Daily screen limit", onDismiss, onConfirm }: Props) {
  const c = useAppColors();
  const initial = useMemo(() => splitMinutes(totalMinutes), [totalMinutes]);
  const [hours, setHours] = useState(initial.hours);
  const [minutes, setMinutes] = useState(initial.minutes);

  const hourItems = useMemo(() => Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")), []);
  const minuteItems = useMemo(() => Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")), []);

  useEffect(() => {
    if (!visible) return;
    const parts = splitMinutes(totalMinutes);
    setHours(parts.hours);
    setMinutes(parts.minutes);
  }, [visible, totalMinutes]);

  return (
    <PickerModalSheet visible={visible} onDismiss={onDismiss}>
      <Text variant="titleLarge" style={[styles.title, { color: c.text }]}>
        {title}
      </Text>
      <View style={styles.wheelRow}>
        <WheelPickerColumn items={hourItems} selectedIndex={hours} onSelect={setHours} suffix="h" width={96} />
        <WheelPickerColumn items={minuteItems} selectedIndex={minutes} onSelect={setMinutes} suffix="m" width={96} />
      </View>
      <View style={styles.actions}>
        <Button onPress={onDismiss}>Cancel</Button>
        <Button
          mode="contained"
          onPress={() => {
            onConfirm(combineMinutes(hours, minutes));
            onDismiss();
          }}
        >
          Done
        </Button>
      </View>
    </PickerModalSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    fontWeight: "800",
    textAlign: "center",
  },
  wheelRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    minHeight: WHEEL_VISIBLE_HEIGHT,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
});
