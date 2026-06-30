import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { PickerModalSheet } from "@/components/parent/PickerModalSheet";
import { WheelPickerColumn, WHEEL_VISIBLE_HEIGHT } from "@/components/parent/WheelPickerColumn";
import { useAppColors } from "@/theme/useAppColors";
import {
  birthdayIsoFromParts,
  birthdayYearRange,
  daysInMonth,
  formatBirthdayDisplay,
  parseBirthdayIso,
  validateBirthdayIso,
} from "@/utils/childBirthday";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Props = {
  visible: boolean;
  birthdayIso: string;
  title?: string;
  onDismiss: () => void;
  onConfirm: (birthdayIso: string) => void;
};

export function BirthdayPickerModal({
  visible,
  birthdayIso,
  title = "Child's birthday",
  onDismiss,
  onConfirm,
}: Props) {
  const c = useAppColors();
  const { minYear, maxYear } = useMemo(() => birthdayYearRange(), [visible]);
  const yearItems = useMemo(
    () => Array.from({ length: maxYear - minYear + 1 }, (_, i) => String(minYear + i)),
    [maxYear, minYear]
  );

  const initial = useMemo(() => {
    const parsed = parseBirthdayIso(birthdayIso);
    if (parsed && parsed.year >= minYear && parsed.year <= maxYear) {
      return parsed;
    }
    const midYear = Math.floor((minYear + maxYear) / 2);
    return { year: midYear, month: 6, day: 15 };
  }, [birthdayIso, maxYear, minYear]);

  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [day, setDay] = useState(initial.day);
  const [error, setError] = useState<string | null>(null);

  const maxDay = daysInMonth(year, month);
  const dayItems = useMemo(
    () => Array.from({ length: maxDay }, (_, i) => String(i + 1).padStart(2, "0")),
    [maxDay]
  );

  useEffect(() => {
    if (!visible) {
      return;
    }
    setYear(initial.year);
    setMonth(initial.month);
    setDay(Math.min(initial.day, daysInMonth(initial.year, initial.month)));
    setError(null);
  }, [visible, initial.day, initial.month, initial.year]);

  useEffect(() => {
    if (day > maxDay) {
      setDay(maxDay);
    }
  }, [day, maxDay]);

  const yearIndex = Math.max(0, yearItems.indexOf(String(year)));
  const monthIndex = month - 1;
  const dayIndex = Math.max(0, Math.min(maxDay - 1, day - 1));

  const previewIso = birthdayIsoFromParts(year, month, day);

  return (
    <PickerModalSheet visible={visible} onDismiss={onDismiss}>
      <Text variant="titleLarge" style={[styles.title, { color: c.text }]}>
        {title}
      </Text>
      <Text variant="bodySmall" style={{ color: c.subtext, textAlign: "center" }}>
        Uses Manila date · age updates automatically
      </Text>
      <View style={styles.wheelRow}>
        <WheelPickerColumn
          items={MONTH_LABELS}
          selectedIndex={monthIndex}
          onSelect={(index) => setMonth(index + 1)}
          width={72}
        />
        <WheelPickerColumn
          items={dayItems}
          selectedIndex={dayIndex}
          onSelect={(index) => setDay(index + 1)}
          width={64}
        />
        <WheelPickerColumn
          items={yearItems}
          selectedIndex={yearIndex}
          onSelect={(index) => setYear(Number(yearItems[index]))}
          width={88}
        />
      </View>
      <Text variant="labelLarge" style={{ color: c.primaryDark, textAlign: "center", fontWeight: "700" }}>
        {formatBirthdayDisplay(previewIso)}
      </Text>
      {error ? (
        <Text variant="bodySmall" style={{ color: c.error, textAlign: "center" }}>
          {error}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button onPress={onDismiss}>Cancel</Button>
        <Button
          mode="contained"
          onPress={() => {
            const result = validateBirthdayIso(previewIso);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            onConfirm(result.birthday);
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
    gap: 8,
    minHeight: WHEEL_VISIBLE_HEIGHT,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
});
