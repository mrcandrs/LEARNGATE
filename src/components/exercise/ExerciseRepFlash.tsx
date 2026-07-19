import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";

type Props = {
  /** Bump this (e.g. completed count or a flash id) to replay the pop. */
  triggerKey: number;
  label?: string;
};

/**
 * Big centered "+1" that pops in and fades out — kids can see a counted rep clearly.
 */
export function ExerciseRepFlash({ triggerKey, label = "+1" }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.6)).current;
  const lastKey = useRef(0);

  useEffect(() => {
    if (triggerKey <= 0 || triggerKey === lastKey.current) return;
    lastKey.current = triggerKey;

    opacity.setValue(0);
    scale.setValue(0.55);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 140, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1.12, friction: 5, tension: 140, useNativeDriver: true }),
      ]),
      Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.delay(380),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 320, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.2, duration: 320, useNativeDriver: true }),
      ]),
    ]).start();
  }, [triggerKey, opacity, scale]);

  if (triggerKey <= 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { opacity, transform: [{ scale }] }]}
    >
      <Text style={styles.text}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 40,
  },
  text: {
    fontSize: 96,
    fontWeight: "900",
    color: "#FFFFFF",
    textShadowColor: "rgba(34, 197, 94, 0.95)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
    letterSpacing: 2,
  },
});
