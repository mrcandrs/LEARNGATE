import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ExerciseDemo, ExerciseDemoStep } from "@/data/exerciseDemos";
import { useAppColors } from "@/theme/useAppColors";
import { radii, shadows } from "@/theme/theme";
import { formQualityColor, type PoseFormQuality } from "@/services/exercisePoseFormQuality";

type DemoProps = {
  demo: ExerciseDemo;
  exerciseTitle: string;
  exerciseEmoji: string;
};

export function ExerciseDemoCard({ demo, exerciseTitle, exerciseEmoji }: DemoProps) {
  const c = useAppColors();

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text variant="titleSmall" style={{ color: c.primaryDark, fontWeight: "800" }}>
        How to do {exerciseEmoji} {exerciseTitle}
      </Text>
      <Text variant="bodySmall" style={{ color: c.subtext, marginTop: 6 }}>
        {demo.summary}
      </Text>

      {demo.steps.map((step, index) => (
        <DemoStepRow key={step.title} step={step} index={index + 1} />
      ))}

      <View style={[styles.tipRow, { backgroundColor: c.surfaceTint }]}>
        <MaterialCommunityIcons name="lightbulb-on-outline" size={18} color={c.primaryDark} />
        <Text variant="bodySmall" style={{ color: c.subtext, flex: 1 }}>
          {demo.tip}
        </Text>
      </View>
    </View>
  );
}

function DemoStepRow({ step, index }: { step: ExerciseDemoStep; index: number }) {
  const c = useAppColors();

  return (
    <View style={styles.stepRow}>
      <View style={[styles.stepBadge, { backgroundColor: c.primary }]}>
        <Text style={styles.stepBadgeText}>{index}</Text>
      </View>
      <View style={styles.stepText}>
        <Text style={{ color: c.text, fontWeight: "700" }}>{step.title}</Text>
        <Text variant="bodySmall" style={{ color: c.subtext, marginTop: 2 }}>
          {step.detail}
        </Text>
      </View>
    </View>
  );
}

type BadgeProps = {
  quality: PoseFormQuality;
  message: string;
  hint?: string | null;
};

export function ExerciseFormBadge({ quality, message, hint }: BadgeProps) {
  if (quality === "none") return null;

  const color = formQualityColor(quality);
  const icon =
    quality === "too_dark"
      ? "lightbulb-alert-outline"
      : quality === "too_far"
        ? "account-off-outline"
        : quality === "partial"
          ? "arrow-expand-all"
          : quality === "active"
            ? "check-circle-outline"
            : "account-check-outline";

  return (
    <View style={[styles.badge, { backgroundColor: "rgba(0,0,0,0.55)", borderColor: color }]}>
      <MaterialCommunityIcons name={icon} size={20} color={color} />
      <View style={styles.badgeText}>
        <Text style={[styles.badgeTitle, { color }]}>{message}</Text>
        {hint ? (
          <Text variant="bodySmall" style={styles.badgeHint}>
            {hint}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    ...shadows.card,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: radii.md,
    marginTop: 4,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeText: { color: "#FFFFFF", fontWeight: "800", fontSize: 12 },
  stepText: { flex: 1 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 2,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  badgeText: { flex: 1 },
  badgeTitle: { fontWeight: "800", fontSize: 15 },
  badgeHint: { color: "rgba(255,255,255,0.85)", marginTop: 2 },
});
