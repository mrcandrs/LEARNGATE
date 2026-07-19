import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Text } from "react-native-paper";
import {
  formQualityColor,
  silhouetteFillColor,
  type PoseFormQuality,
} from "@/services/exercisePoseFormQuality";

type Props = {
  quality: PoseFormQuality;
  message: string;
};

/**
 * Full-screen Kids360-style overlay — person shape covers nearly the entire camera.
 */
export function ExerciseSilhouetteGuide({ quality, message }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const stroke = formQualityColor(quality === "none" ? "red" : quality);
  const fill = silhouetteFillColor(quality === "none" ? "red" : quality);

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const bodyW = w * 0.94;
  const bodyTop = h * 0.005;
  const bodyH = h * 0.99;

  const silhouettePath = buildPortraitSilhouette(cx, bodyTop, bodyW, bodyH);

  const statusMessage =
    quality === "red"
      ? message || "Stand inside the area"
      : message;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ width, height });
      }}
    >
      {w > 0 && h > 0 ? (
        <>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
          <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
            <Path d={silhouettePath} fill="transparent" stroke={stroke} strokeWidth={5} />
          </Svg>

          <View style={[styles.statusBar, { borderColor: stroke }]}>
            <Text style={[styles.statusText, { color: stroke }]} numberOfLines={2}>
              {statusMessage}
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

function buildPortraitSilhouette(cx: number, top: number, width: number, height: number): string {
  const headR = width * 0.11;
  const headCy = top + headR * 1.05;
  const shoulderY = top + headR * 2.2;
  const hipY = top + height * 0.5;
  const footY = top + height;
  const halfW = width / 2;
  const legW = width * 0.17;

  return [
    `M ${cx} ${headCy - headR}`,
    `A ${headR} ${headR} 0 1 1 ${cx - 0.01} ${headCy - headR}`,
    `L ${cx - halfW * 0.92} ${shoulderY}`,
    `L ${cx - halfW} ${hipY}`,
    `L ${cx - legW} ${hipY}`,
    `L ${cx - legW * 0.88} ${footY}`,
    `L ${cx - legW * 0.32} ${footY}`,
    `L ${cx - legW * 0.32} ${hipY + (footY - hipY) * 0.32}`,
    `L ${cx + legW * 0.32} ${hipY + (footY - hipY) * 0.32}`,
    `L ${cx + legW * 0.32} ${footY}`,
    `L ${cx + legW * 0.88} ${footY}`,
    `L ${cx + legW} ${hipY}`,
    `L ${cx + halfW} ${hipY}`,
    `L ${cx + halfW * 0.92} ${shoulderY}`,
    `Z`,
  ].join(" ");
}

const styles = StyleSheet.create({
  statusBar: {
    position: "absolute",
    left: "5%",
    right: "5%",
    bottom: "6%",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 14,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
  },
  statusText: {
    fontWeight: "800",
    fontSize: 15,
    textAlign: "center",
  },
});
