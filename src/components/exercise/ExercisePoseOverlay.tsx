import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import { POSE_CONNECTIONS, type PoseLandmark } from "@mefitzgerald/expo-pose-detection";
import { mapLandmarkToView } from "@/services/exercisePoseCoords";
import { formQualityColor, type PoseFormQuality } from "@/services/exercisePoseFormQuality";

const MIN_LIKELIHOOD = 0.35;

type Props = {
  landmarks: PoseLandmark[] | null;
  frameWidth: number;
  frameHeight: number;
  quality: PoseFormQuality;
  /** Stream pose already mirrors X — set false to avoid double-flip. */
  mirrored?: boolean;
  /** Use portrait rotation + Y-flip for live stream frames. */
  streamMapping?: boolean;
  /** Landmarks already passed through normalizePoseLandmarks (live stream). */
  normalizedCoords?: boolean;
};

export function ExercisePoseOverlay({
  landmarks,
  frameWidth,
  frameHeight,
  quality,
  mirrored = false,
  streamMapping = false,
  normalizedCoords = false,
}: Props) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const color = formQualityColor(quality);
  const showSkeleton =
    quality !== "none" && quality !== "too_far" && Boolean(landmarks?.length);
  const viewWidth = layout.width;
  const viewHeight = layout.height;

  const { lines, dots } = useMemo(() => {
    if (!showSkeleton || !landmarks || viewWidth <= 0 || viewHeight <= 0 || frameWidth <= 0 || frameHeight <= 0) {
      return { lines: [] as { x1: number; y1: number; x2: number; y2: number }[], dots: [] as { x: number; y: number }[] };
    }

    const byType = new Map<number, { x: number; y: number }>();
    for (const lm of landmarks) {
      if (lm.inFrameLikelihood < MIN_LIKELIHOOD) continue;
      const pt = mapLandmarkToView(
        lm,
        frameWidth,
        frameHeight,
        viewWidth,
        viewHeight,
        mirrored,
        normalizedCoords,
        streamMapping,
      );
      if (pt) byType.set(lm.type, pt);
    }

    const lineSegments = POSE_CONNECTIONS.flatMap(([a, b]) => {
      const p1 = byType.get(a);
      const p2 = byType.get(b);
      if (!p1 || !p2) return [];
      return [{ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }];
    });

    return { lines: lineSegments, dots: [...byType.values()] };
  }, [showSkeleton, landmarks, frameWidth, frameHeight, viewWidth, viewHeight, mirrored, normalizedCoords, streamMapping]);

  if (quality === "none") return null;

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setLayout({ width, height });
      }}
      pointerEvents="none"
    >
      {showSkeleton && viewWidth > 0 && viewHeight > 0 ? (
        <Svg width={viewWidth} height={viewHeight} style={styles.svg}>
          {lines.map((l, i) => (
            <Line
              key={`l-${i}`}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke={color}
              strokeWidth={4}
              strokeLinecap="round"
              opacity={0.9}
            />
          ))}
          {dots.map((d, i) => (
            <Circle key={`d-${i}`} cx={d.x} cy={d.y} r={5} fill={color} opacity={0.95} />
          ))}
        </Svg>
      ) : null}

      {quality === "too_far" ? <View style={[styles.edgeGlow, { borderColor: color }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  svg: {
    ...StyleSheet.absoluteFillObject,
  },
  edgeGlow: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 4,
  },
});
