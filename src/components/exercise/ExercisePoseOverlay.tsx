import { memo, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import type { PoseLandmark } from "@mefitzgerald/expo-pose-detection";
import { mapLandmarkToPreview } from "@/services/exercisePoseCoords";
import {
  FULL_BODY_CONNECTIONS,
  FULL_BODY_JOINTS,
  SQUAT_KEY_JOINTS,
} from "@/services/exercisePoseLandmarks";
import { formQualityColor, type PoseFormQuality } from "@/services/exercisePoseFormQuality";

const MIN_LIKELIHOOD = 0.12;

type Props = {
  /** Landmarks in ML Kit upright + selfie-mirrored content space. */
  landmarks: PoseLandmark[] | null;
  contentWidth: number;
  contentHeight: number;
  quality: PoseFormQuality;
};

/**
 * Full-body skeleton overlay. Squats key joints (shoulders/hips/knees) are drawn larger.
 */
export const ExercisePoseOverlay = memo(function ExercisePoseOverlay({
  landmarks,
  contentWidth,
  contentHeight,
  quality,
}: Props) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const color = formQualityColor(quality === "none" ? "red" : quality);
  const viewWidth = layout.width;
  const viewHeight = layout.height;
  const showSkeleton = Boolean(landmarks?.length) && quality !== "none";

  const { lines, dots } = useMemo(() => {
    if (!showSkeleton || !landmarks || viewWidth <= 0 || viewHeight <= 0) {
      return {
        lines: [] as { x1: number; y1: number; x2: number; y2: number }[],
        dots: [] as { x: number; y: number; key: number; keyJoint: boolean }[],
      };
    }

    const byType = new Map<number, { x: number; y: number }>();
    for (const lm of landmarks) {
      if (lm.inFrameLikelihood < MIN_LIKELIHOOD) continue;
      const pt = mapLandmarkToPreview(
        lm,
        contentWidth,
        contentHeight,
        viewWidth,
        viewHeight,
        landmarks,
      );
      if (pt) byType.set(lm.type, pt);
    }

    const lines = FULL_BODY_CONNECTIONS.flatMap(([a, b]) => {
      const p1 = byType.get(a);
      const p2 = byType.get(b);
      if (!p1 || !p2) return [];
      return [{ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }];
    });

    const dots = FULL_BODY_JOINTS.map((type) => {
      const p = byType.get(type);
      if (!p) return null;
      return { ...p, key: type, keyJoint: SQUAT_KEY_JOINTS.has(type) };
    }).filter(Boolean) as { x: number; y: number; key: number; keyJoint: boolean }[];

    return { lines, dots };
  }, [showSkeleton, landmarks, contentWidth, contentHeight, viewWidth, viewHeight]);

  if (!showSkeleton) return null;

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setLayout((prev) =>
          prev.width === width && prev.height === height ? prev : { width, height },
        );
      }}
      pointerEvents="none"
    >
      {viewWidth > 0 && viewHeight > 0 ? (
        <Svg width={viewWidth} height={viewHeight} style={styles.svg}>
          {lines.map((l, i) => (
            <Line
              key={`l-${i}`}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke={color}
              strokeWidth={3.5}
              strokeLinecap="round"
              opacity={0.9}
            />
          ))}
          {dots.map((d) => (
            <Circle
              key={`d-${d.key}`}
              cx={d.x}
              cy={d.y}
              r={d.keyJoint ? 8 : 5}
              fill={color}
              opacity={1}
            />
          ))}
        </Svg>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  svg: {
    ...StyleSheet.absoluteFillObject,
  },
});
