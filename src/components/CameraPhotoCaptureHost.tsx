import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { IconButton, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  finishCameraPhoto,
  registerCameraCaptureHandler,
  type CameraCaptureRequest,
} from "@/services/photoCapture";
import { useAppColors } from "@/theme/useAppColors";
import { radii } from "@/theme/theme";

/**
 * In-app camera capture using expo-camera (already in the native build).
 * Used when expo-image-picker native module is missing or for chore proof photos.
 */
export function CameraPhotoCaptureHost() {
  const c = useAppColors();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [visible, setVisible] = useState(false);
  const [request, setRequest] = useState<CameraCaptureRequest | null>(null);
  const [capturing, setCapturing] = useState(false);

  const close = useCallback((uri: string | null) => {
    setVisible(false);
    setRequest(null);
    finishCameraPhoto(uri);
  }, []);

  useEffect(() => {
    registerCameraCaptureHandler((next) => {
      setRequest(next);
      setVisible(true);
    });
    return () => registerCameraCaptureHandler(null);
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (!permission?.granted) {
      void requestPermission();
    }
  }, [visible, permission?.granted, requestPermission]);

  const onCapture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.82,
        skipProcessing: true,
      });
      close(photo?.uri ?? null);
    } catch {
      close(null);
    } finally {
      setCapturing(false);
    }
  };

  if (!visible || !request) {
    return null;
  }

  return (
    <Modal visible animationType="slide" onRequestClose={() => close(null)}>
      <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Text variant="titleMedium" style={{ color: c.text, fontWeight: "700", flex: 1 }}>
            {request.title}
          </Text>
          <IconButton icon="close" onPress={() => close(null)} accessibilityLabel="Cancel" />
        </View>
        {request.hint ? (
          <Text style={[styles.hint, { color: c.subtext }]}>{request.hint}</Text>
        ) : null}

        {!permission?.granted ? (
          <View style={styles.centered}>
            <Text style={{ color: c.text, textAlign: "center", marginBottom: 12 }}>
              Camera permission is required.
            </Text>
            <Pressable style={[styles.permBtn, { backgroundColor: c.primary }]} onPress={() => void requestPermission()}>
              <Text style={styles.permBtnText}>Allow camera</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={[styles.cameraWrap, { borderColor: c.border }]}>
              <CameraView ref={cameraRef} style={styles.camera} facing={request.facing} />
            </View>
            <Pressable
              style={[styles.shutter, { backgroundColor: c.primary, opacity: capturing ? 0.6 : 1 }]}
              onPress={() => void onCapture()}
              disabled={capturing}
              accessibilityRole="button"
              accessibilityLabel="Take photo"
            >
              <MaterialCommunityIcons name="camera" size={32} color="#FFFFFF" />
            </Pressable>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16, paddingBottom: 24 },
  topBar: { flexDirection: "row", alignItems: "center" },
  hint: { marginBottom: 12, lineHeight: 20 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  permBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: radii.pill },
  permBtnText: { color: "#FFFFFF", fontWeight: "700" },
  cameraWrap: {
    flex: 1,
    borderRadius: radii.lg,
    overflow: "hidden",
    borderWidth: 1,
    minHeight: 320,
  },
  camera: { flex: 1 },
  shutter: {
    alignSelf: "center",
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
});
