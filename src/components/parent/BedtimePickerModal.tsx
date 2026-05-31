import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { useAppColors } from "@/theme/useAppColors";
import { minutesToBedtimeString, parseBedtimeMinutes } from "@/utils/screenControlSteppers";
import { WheelPickerColumn, WHEEL_VISIBLE_HEIGHT } from "@/components/parent/WheelPickerColumn";
import { PickerModalSheet } from "@/components/parent/PickerModalSheet";

type Props = {
  visible: boolean;
  value24h: string;
  title?: string;
  onDismiss: () => void;
  onConfirm: (hhmm: string) => void;
};

function to12hParts(hhmm: string) {
  const total = parseBedtimeMinutes(hhmm);
  const hours24 = Math.floor(total / 60);
  const minute = total % 60;
  const pm = hours24 >= 12;
  const hour12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return { hour12, minute, pm };
}

function from12hParts(hour12: number, minute: number, pm: boolean) {
  let h24 = hour12 % 12;
  if (pm) {
    h24 += 12;
  }
  return minutesToBedtimeString(h24 * 60 + minute);
}

export function BedtimePickerModal({ visible, value24h, title = "Set time", onDismiss, onConfirm }: Props) {
  const c = useAppColors();
  const initial = useMemo(() => to12hParts(value24h), [value24h]);
  const [hour12, setHour12] = useState(initial.hour12 - 1);
  const [minute, setMinute] = useState(initial.minute);
  const [pm, setPm] = useState(initial.pm ? 1 : 0);

  const hourItems = useMemo(() => Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")), []);
  const minuteItems = useMemo(() => Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")), []);
  const periodItems = useMemo(() => ["AM", "PM"], []);

  useEffect(() => {
    if (!visible) return;
    const parts = to12hParts(value24h);
    setHour12(parts.hour12 - 1);
    setMinute(parts.minute);
    setPm(parts.pm ? 1 : 0);
  }, [visible, value24h]);

  return (
    <PickerModalSheet visible={visible} onDismiss={onDismiss}>
      <Text variant="titleLarge" style={[styles.title, { color: c.text }]}>
        {title}
      </Text>
      <View style={styles.wheelRow}>
        <WheelPickerColumn items={hourItems} selectedIndex={hour12} onSelect={setHour12} width={80} />
        <Text style={[styles.colon, { color: c.text }]}>:</Text>
        <WheelPickerColumn items={minuteItems} selectedIndex={minute} onSelect={setMinute} width={80} />
        <WheelPickerColumn items={periodItems} selectedIndex={pm} onSelect={setPm} width={80} />
      </View>
      <View style={styles.actions}>
        <Button onPress={onDismiss}>Cancel</Button>
        <Button
          mode="contained"
          onPress={() => {
            onConfirm(from12hParts(hour12 + 1, minute, pm === 1));
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
    gap: 6,
    minHeight: WHEEL_VISIBLE_HEIGHT,
  },
  colon: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
});
