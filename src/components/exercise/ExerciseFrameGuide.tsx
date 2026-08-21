import { memo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import type { ExerciseId } from "@/data/exercises";
import { exerciseFrameMargins } from "@/services/exerciseFrameBounds";
import {
  formQualityColor,
  type PoseFormQuality,
} from "@/services/exercisePoseFormQuality";

type Props = {
  quality: PoseFormQuality;
  message: string;
  exerciseId?: ExerciseId;
};

/** Border + one status line. Taller frame for full-body exercises. */
export const ExerciseFrameGuide = memo(function ExerciseFrameGuide({
  quality,
  message,
  exerciseId,
}: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const stroke = formQualityColor(quality === "none" ? "red" : quality);
  const { marginX, marginY } = exerciseFrameMargins(exerciseId);

  const w = size.width;
  const h = size.height;
  const insetX = w * marginX;
  const insetY = h * marginY;
  const frameW = w - insetX * 2;
  const frameH = h - insetY * 2;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((prev) =>
          prev.width === width && prev.height === height ? prev : { width, height },
        );
      }}
    >
      {w > 0 && h > 0 ? (
        <>
          <View
            style={[
              styles.frame,
              {
                left: insetX,
                top: insetY,
                width: frameW,
                height: frameH,
                borderColor: stroke,
              },
            ]}
          />
          <View style={[styles.corner, styles.cornerTL, { left: insetX, top: insetY, borderColor: stroke }]} />
          <View
            style={[
              styles.corner,
              styles.cornerTR,
              { left: insetX + frameW - 28, top: insetY, borderColor: stroke },
            ]}
          />
          <View
            style={[
              styles.corner,
              styles.cornerBL,
              { left: insetX, top: insetY + frameH - 28, borderColor: stroke },
            ]}
          />
          <View
            style={[
              styles.corner,
              styles.cornerBR,
              { left: insetX + frameW - 28, top: insetY + frameH - 28, borderColor: stroke },
            ]}
          />

          {message ? (
            <View style={[styles.statusBar, { borderColor: stroke }]}>
              <Text style={[styles.statusText, { color: stroke }]} numberOfLines={2}>
                {message}
              </Text>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  frame: {
    position: "absolute",
    borderWidth: 4,
    borderRadius: 6,
  },
  corner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderWidth: 6,
  },
  cornerTL: {
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 8,
  },
  statusBar: {
    position: "absolute",
    left: "5%",
    right: "5%",
    bottom: "4%",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 14,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  statusText: {
    fontWeight: "800",
    fontSize: 15,
    textAlign: "center",
  },
});
