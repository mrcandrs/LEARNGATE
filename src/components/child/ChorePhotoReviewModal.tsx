import { Image, Modal, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Text } from "react-native-paper";
import { useAppColors } from "@/theme/useAppColors";
import { radii } from "@/theme/theme";
import { useLocale } from "@/store/LocaleContext";

type Props = {
  visible: boolean;
  photoUri: string | null;
  taskTitle: string;
  uploading: boolean;
  onRetake: () => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export function ChorePhotoReviewModal({
  visible,
  photoUri,
  taskTitle,
  uploading,
  onRetake,
  onSubmit,
  onCancel,
}: Props) {
  const c = useAppColors();
  const { t } = useLocale();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: c.card }]}>
          <Text variant="titleLarge" style={[styles.title, { color: c.text }]}>
            {t("child.chore.reviewPhoto")}
          </Text>
          <Text variant="bodyMedium" style={{ color: c.subtext, textAlign: "center" }}>
            {taskTitle}
          </Text>

          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" accessibilityLabel={t("child.chore.previewLabel")} />
          ) : (
            <View style={[styles.preview, styles.previewPlaceholder, { backgroundColor: c.mutedSurface }]}>
              <ActivityIndicator color={c.primary} />
            </View>
          )}

          {uploading ? (
            <View style={styles.uploadingRow}>
              <ActivityIndicator size="small" color={c.primary} />
              <Text style={{ color: c.subtext }}>{t("child.chore.uploading")}</Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Button mode="text" onPress={onCancel} disabled={uploading}>
              {t("common.cancel")}
            </Button>
            <Button mode="outlined" onPress={onRetake} disabled={uploading}>
              {t("common.retake")}
            </Button>
            <Button mode="contained" onPress={onSubmit} loading={uploading} disabled={uploading || !photoUri}>
              {t("common.submit")}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 20,
  },
  sheet: {
    borderRadius: radii.lg,
    padding: 20,
    gap: 12,
  },
  title: {
    fontWeight: "800",
    textAlign: "center",
  },
  preview: {
    width: "100%",
    height: 280,
    borderRadius: radii.md,
    backgroundColor: "#111827",
  },
  previewPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  uploadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 4,
  },
});
