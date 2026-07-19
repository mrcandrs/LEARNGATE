import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { formQualityColor, type PoseFormQuality } from "@/services/exercisePoseFormQuality";

type Props = {
  quality: PoseFormQuality;
};

/** Dashed outline — upper-body framing (shoulders + hips). */
export function ExerciseBodyGuide({ quality }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const color = formQualityColor(quality === "none" ? "red" : quality);

  const padX = size.width * 0.14;
  const padY = size.height * 0.1;
  const rectW = size.width * 0.72;
  const rectH = size.height * 0.62;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ width, height });
      }}
    >
      {size.width > 0 && size.height > 0 ? (
        <Svg width={size.width} height={size.height}>
          <Rect
            x={padX}
            y={padY}
            width={rectW}
            height={rectH}
            rx={16}
            ry={16}
            stroke={color}
            strokeWidth={3}
            strokeDasharray="12 8"
            fill="none"
            opacity={0.75}
          />
        </Svg>
      ) : null}
    </View>
  );
}
