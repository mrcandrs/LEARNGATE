import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { AgeBandGamesBanner } from "@/components/child/AgeBandGamesBanner";
import { ChildGameCard } from "@/components/child/ChildGameCard";
import { getAgeBandForChild } from "@/data/childAgeBands";
import { getGamesForChildAge } from "@/data/childGames";
import { getChildAge } from "@/utils/childBirthday";
import { EXERCISES } from "@/data/exercises";
import { useChildProfile } from "@/hooks/useChildProfile";
import { radii, shadows } from "@/theme/theme";
import { useAppColors } from "@/theme/useAppColors";
import type { ChildActivitiesStackParamList } from "@/types/navigation";
type Nav = NativeStackNavigationProp<ChildActivitiesStackParamList, "ActivitiesMain">;
type Route = RouteProp<ChildActivitiesStackParamList, "ActivitiesMain">;

type Segment = "games" | "movement";

export function ChildActivitiesScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const c = useAppColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(c), [c]);
  const { child } = useChildProfile();
  const childAge = child ? getChildAge(child) : null;
  const ageBand = useMemo(() => getAgeBandForChild(childAge), [childAge]);
  const ageGames = useMemo(() => getGamesForChildAge(childAge), [childAge]);
  const [segment, setSegment] = useState<Segment>(route.params?.segment ?? "games");

  useEffect(() => {
    if (route.params?.segment) {
      setSegment(route.params.segment);
    }
  }, [route.params?.segment]);

  useFocusEffect(
    useCallback(() => {
      const key = route.params?.navKey;
      if (!key) {
        return;
      }
      if (route.params?.segment) {
        setSegment(route.params.segment);
      }
      navigation.setParams({ segment: undefined, navKey: undefined });
    }, [navigation, route.params?.navKey, route.params?.segment])
  );

  return (
    <ScreenContainer scroll contentPadding={0} includeTopInset={false}>
      <LinearGradient
        colors={[...c.heroGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 14 }]}
      >
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Activities
        </Text>
        <Text variant="bodyMedium" style={styles.headerSub}>
          {segment === "games"
            ? ageBand.gamesHint
            : "Play games or complete movement activities."}
        </Text>
        {segment === "games" ? (
          <View style={styles.bannerWrap}>
            <AgeBandGamesBanner band={ageBand} childAge={childAge} />
          </View>
        ) : null}
      </LinearGradient>

      <View style={styles.pad}>
        <View style={styles.segmentWrap}>
          <Pressable
            style={[styles.segmentBtn, segment === "games" && styles.segmentBtnActive]}
            onPress={() => setSegment("games")}
          >
            <Text style={[styles.segmentText, segment === "games" && styles.segmentTextActive]}>Learning Games</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, segment === "movement" && styles.segmentBtnActive]}
            onPress={() => setSegment("movement")}
          >
            <Text style={[styles.segmentText, segment === "movement" && styles.segmentTextActive]}>Movement Activity</Text>
          </Pressable>
        </View>

        {segment === "games" ? (
          <>
            <View style={styles.sectionHead}>
              <View style={[styles.sectionIcon, { backgroundColor: c.sectionIconBg }]}>
                <MaterialCommunityIcons name="gamepad-variant" size={22} color={c.primaryDark} />
              </View>
              <View style={styles.sectionText}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  {ageBand.heroTitle}
                </Text>
                <Text variant="bodySmall" style={styles.sectionHint}>
                  {ageGames.length} games picked for {ageBand.label.toLowerCase()}s ({ageBand.shortLabel}). Each
                  round has 10 questions — assigned tasks use your learning level.
                </Text>
              </View>
            </View>
            <View style={styles.grid}>
              {ageGames.map((game) => (
                <Pressable
                  key={game.id}
                  style={({ pressed }) => [styles.gridItem, styles.gridItemFill, pressed && styles.pressed]}
                  onPress={() => navigation.navigate("GamePlay", { gameId: game.id, title: game.title })}
                >
                  <ChildGameCard game={game} />
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <>
            <View style={styles.sectionHead}>
              <View style={[styles.sectionIcon, { backgroundColor: c.surfaceTint }]}>
                <MaterialCommunityIcons name="run" size={22} color={c.primaryDark} />
              </View>
              <View style={styles.sectionText}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Movement Activity
                </Text>
                <Text variant="bodySmall" style={styles.sectionHint}>
                  Physical exercises from the LearnGate movement activity module.
                </Text>
              </View>
            </View>
            <View style={styles.grid}>
              {EXERCISES.map((ex) => (
                <Pressable
                  key={ex.id}
                  style={({ pressed }) => [styles.gridItem, styles.gridItemFill, pressed && styles.pressed]}
                  onPress={() =>
                    navigation.navigate("ExerciseSession", {
                      exerciseId: ex.id,
                      title: ex.title,
                    })
                  }
                >
                  <View style={[styles.moveCard, { backgroundColor: c.card, borderColor: c.border }]}>
                    <View style={styles.moveBadge}>
                      <Text style={styles.moveBadgeText}>0 out of {ex.defaultReps}</Text>
                    </View>
                    <View style={styles.moveBody}>
                      <Text style={styles.moveEmoji}>{ex.emoji}</Text>
                      <Text variant="titleSmall" style={styles.moveTitle}>
                        {ex.title}
                      </Text>
                      <Text variant="bodySmall" style={styles.moveDesc} numberOfLines={2}>
                        {ex.cardDescription}
                      </Text>
                    </View>
                    <Text style={[styles.moveStart, { color: c.primary }]}>Start ›</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

function createStyles(c: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    header: {
      paddingHorizontal: 16,
      paddingBottom: 20,
      borderBottomLeftRadius: radii.lg,
      borderBottomRightRadius: radii.lg,
      ...shadows.card,
    },
    headerTitle: { color: "#FFFFFF", fontWeight: "800" },
    headerSub: { color: "rgba(255,255,255,0.92)", marginTop: 4 },
    bannerWrap: { marginTop: 12 },
    pad: { paddingHorizontal: 16, paddingBottom: 24, gap: 14 },
    segmentWrap: {
      flexDirection: "row",
      backgroundColor: c.card,
      borderRadius: radii.pill,
      padding: 4,
      borderWidth: 1,
      borderColor: c.border,
    },
    segmentBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: radii.pill,
      alignItems: "center",
    },
    segmentBtnActive: { backgroundColor: c.primaryDark },
    segmentText: { color: c.subtext, fontWeight: "600" },
    segmentTextActive: { color: "#FFFFFF", fontWeight: "700" },
    sectionHead: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
    sectionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    sectionText: { flex: 1 },
    sectionTitle: { color: c.text, fontWeight: "700" },
    sectionHint: { color: c.subtext, marginTop: 2 },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: 10,
    },
    gridItem: { width: "48%" },
    gridItemFill: { alignSelf: "flex-start" },
    pressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
    moveCard: {
      borderRadius: radii.md,
      padding: 12,
      height: 188,
      borderWidth: 1,
      overflow: "hidden",
      justifyContent: "space-between",
      ...shadows.card,
    },
    moveBadge: {
      alignSelf: "flex-start",
      backgroundColor: c.mutedSurface,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radii.sm,
    },
    moveBadgeText: { color: c.subtext, fontSize: 11, fontWeight: "600" },
    moveBody: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 6,
      minHeight: 96,
    },
    moveEmoji: { fontSize: 32, marginBottom: 4 },
    moveTitle: { color: c.text, fontWeight: "700", textAlign: "center" },
    moveDesc: { color: c.subtext, textAlign: "center", marginTop: 4, lineHeight: 16 },
    moveStart: { fontWeight: "700", marginTop: 8 },
  });
}
