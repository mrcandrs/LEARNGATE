import { memo, useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type Props = {
  reached: boolean;
  /** Compact for tight layouts; default is the workout HUD size. */
  size?: "md" | "lg";
};

/**
 * Prize-like goal star for the exercise progress bar —
 * soft glow + pulse while chasing, celebratory pop when reached.
 */
export const ExerciseGoalStar = memo(function ExerciseGoalStar({
  reached,
  size = "lg",
}: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  const celebrate = useRef(new Animated.Value(1)).current;
  const wasReached = useRef(reached);

  const dim = size === "lg" ? 40 : 32;
  const icon = size === "lg" ? 24 : 20;
  const glowPad = size === "lg" ? 10 : 8;

  useEffect(() => {
    if (reached) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reached]);

  useEffect(() => {
    if (reached && !wasReached.current) {
      celebrate.setValue(0.72);
      Animated.sequence([
        Animated.spring(celebrate, {
          toValue: 1.22,
          friction: 4,
          tension: 160,
          useNativeDriver: true,
        }),
        Animated.spring(celebrate, {
          toValue: 1,
          friction: 6,
          tension: 140,
          useNativeDriver: true,
        }),
      ]).start();
    }
    wasReached.current = reached;
  }, [celebrate, reached]);

  const scale = reached
    ? celebrate
    : pulse.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.12],
      });

  const glowOpacity = reached
    ? 0.95
    : pulse.interpolate({
        inputRange: [0, 1],
        outputRange: [0.45, 0.9],
      });

  return (
    <View style={[styles.wrap, { width: dim + glowPad * 2, height: dim + glowPad * 2 }]}>
      <Animated.View
        style={[
          styles.glow,
          {
            width: dim + glowPad * 2,
            height: dim + glowPad * 2,
            borderRadius: (dim + glowPad * 2) / 2,
            opacity: glowOpacity,
            transform: [{ scale }],
          },
        ]}
      />
      <Animated.View style={{ transform: [{ scale }] }}>
        <LinearGradient
          colors={reached ? ["#FFE082", "#F59E0B", "#EA580C"] : ["#FFF3C4", "#FBBF24", "#F59E0B"]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={[
            styles.badge,
            {
              width: dim,
              height: dim,
              borderRadius: dim / 2,
              borderColor: reached ? "#FFF8E1" : "rgba(255, 248, 225, 0.85)",
            },
          ]}
        >
          <MaterialCommunityIcons
            name={reached ? "star" : "star-outline"}
            size={icon}
            color={reached ? "#FFFFFF" : "#FFFDE7"}
            style={styles.icon}
          />
          {!reached ? (
            <View style={styles.sparkle} pointerEvents="none">
              <MaterialCommunityIcons name="star-four-points" size={10} color="#FFFFFF" />
            </View>
          ) : null}
        </LinearGradient>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    backgroundColor: "rgba(251, 191, 36, 0.55)",
  },
  badge: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.65,
    shadowRadius: 8,
    elevation: 8,
  },
  icon: {
    textShadowColor: "rgba(146, 64, 14, 0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  sparkle: {
    position: "absolute",
    top: 3,
    right: 4,
    opacity: 0.95,
  },
});
