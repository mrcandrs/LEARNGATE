import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";

const CONFETTI_COLORS = [
  "#C5E84D",
  "#F59E0B",
  "#8B5CF6",
  "#22C55E",
  "#EF4444",
  "#3B82F6",
  "#EC4899",
  "#FACC15",
  "#14B8A6",
  "#FB7185",
];

type ParticleSpec = {
  id: number;
  left: number;
  color: string;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
  shape: "rect" | "circle";
  startY: number;
};

type Props = {
  /** Increment to replay the burst. */
  triggerKey?: number;
  particleCount?: number;
};

function createParticles(count: number, width: number): ParticleSpec[] {
  return Array.from({ length: count }, (_, id) => {
    const fromCenter = Math.random() < 0.35;
    return {
      id,
      left: fromCenter ? 0.35 + Math.random() * 0.3 : Math.random(),
      color: CONFETTI_COLORS[id % CONFETTI_COLORS.length],
      size: 6 + Math.floor(Math.random() * 7),
      delay: Math.floor(Math.random() * 420),
      duration: 1800 + Math.floor(Math.random() * 900),
      drift: (Math.random() - 0.5) * width * 0.45,
      spin: (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 540),
      shape: Math.random() > 0.45 ? "rect" : "circle",
      startY: fromCenter ? -10 - Math.random() * 30 : -20 - Math.random() * 80,
    };
  });
}

function ConfettiBurstLayer({ particleCount }: { particleCount: number }) {
  const { width, height } = Dimensions.get("window");
  const particles = useMemo(() => createParticles(particleCount, width), [particleCount, width]);
  const progress = useRef(particles.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const animations = progress.map((value, index) => {
      const spec = particles[index];
      return Animated.sequence([
        Animated.delay(spec.delay),
        Animated.timing(value, {
          toValue: 1,
          duration: spec.duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);
    });

    Animated.parallel(animations).start();
  }, [particles, progress]);

  return (
    <View style={styles.layer} pointerEvents="none">
      {particles.map((spec, index) => {
        const value = progress[index];
        const translateY = value.interpolate({
          inputRange: [0, 1],
          outputRange: [spec.startY, height + 48],
        });
        const translateX = value.interpolate({
          inputRange: [0, 0.35, 1],
          outputRange: [0, spec.drift * 0.35, spec.drift],
        });
        const rotate = value.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", `${spec.spin}deg`],
        });
        const opacity = value.interpolate({
          inputRange: [0, 0.08, 0.82, 1],
          outputRange: [0, 1, 1, 0],
        });
        const scale = value.interpolate({
          inputRange: [0, 0.12, 1],
          outputRange: [0.4, 1, 0.85],
        });

        return (
          <Animated.View
            key={spec.id}
            style={[
              styles.particle,
              {
                left: spec.left * width - spec.size / 2,
                width: spec.size,
                height: spec.shape === "rect" ? spec.size * 0.55 : spec.size,
                borderRadius: spec.shape === "circle" ? spec.size / 2 : 2,
                backgroundColor: spec.color,
                opacity,
                transform: [{ translateY }, { translateX }, { rotate }, { scale }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

/**
 * Full-screen confetti overlay for completions and achievements.
 * Bump `triggerKey` to replay.
 */
export function ConfettiBurst({ triggerKey = 0, particleCount = 46 }: Props) {
  const [burstId, setBurstId] = useState(0);
  const lastKeyRef = useRef(0);

  useEffect(() => {
    if (triggerKey <= 0 || triggerKey === lastKeyRef.current) {
      return;
    }
    lastKeyRef.current = triggerKey;
    setBurstId((current) => current + 1);
  }, [triggerKey]);

  if (burstId === 0) {
    return null;
  }

  return <ConfettiBurstLayer key={burstId} particleCount={particleCount} />;
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
    overflow: "hidden",
  },
  particle: {
    position: "absolute",
    top: 0,
  },
});
