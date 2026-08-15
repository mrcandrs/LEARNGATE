import { useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { shadows } from "@/theme/theme";
import { useLocale } from "@/store/LocaleContext";

type Props = {
  visible: boolean;
  stars: number;
  onDismiss: () => void;
  autoDismissMs?: number;
};

const CARD_GREEN = "#4CAF50";

export function AchievementClaimModal({ visible, stars, onDismiss, autoDismissMs = 2800 }: Props) {
  const { t } = useLocale();
  const scale = useRef(new Animated.Value(0.82)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [confettiKey, setConfettiKey] = useState(0);
  const onDismissRef = useRef(onDismiss);
  const openedRef = useRef(false);

  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!visible) {
      openedRef.current = false;
      return;
    }

    if (openedRef.current) {
      return;
    }
    openedRef.current = true;

    setConfettiKey((key) => key + 1);
    scale.setValue(0.82);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 120, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => onDismissRef.current(), autoDismissMs);
    return () => clearTimeout(timer);
  }, [visible, autoDismissMs, opacity, scale]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss">
          <Animated.View style={[styles.cardWrap, { opacity, transform: [{ scale }] }]}>
            <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
              <Text style={styles.title}>{t("common.claimed")}</Text>
              <View style={styles.starWrap}>
                <MaterialCommunityIcons name="star-face" size={92} color="#FFE082" />
              </View>
              <Text style={styles.stars}>{t("achievements.claimStars", { count: stars })}</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
        <View style={styles.confettiLayer} pointerEvents="none">
          <ConfettiBurst triggerKey={confettiKey} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.58)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  confettiLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    elevation: 200,
  },
  cardWrap: {
    width: "100%",
    maxWidth: 280,
    alignItems: "center",
    zIndex: 1,
  },
  card: {
    width: "100%",
    aspectRatio: 1,
    maxWidth: 260,
    borderRadius: 40,
    backgroundColor: CARD_GREEN,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 28,
    gap: 8,
    ...shadows.card,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  starWrap: {
    marginVertical: 4,
  },
  stars: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
});
