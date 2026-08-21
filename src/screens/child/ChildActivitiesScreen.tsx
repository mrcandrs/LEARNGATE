import { useCallback, useEffect, useMemo, useState } from "react";
import { CommonActions, useFocusEffect } from "@react-navigation/native";
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
import { useLocale } from "@/store/LocaleContext";
import { localizedAgeBand, localizedExercise, localizedResolvedGame } from "@/i18n/helpers";
type Nav = NativeStackNavigationProp<ChildActivitiesStackParamList, "ActivitiesMain">;
type Route = RouteProp<ChildActivitiesStackParamList, "ActivitiesMain">;

type Segment = "games" | "movement";

export function ChildActivitiesScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { t } = useLocale();
  const c = useAppColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(c), [c]);
  const { child } = useChildProfile();
  const childAge = child ? getChildAge(child) : null;
  const ageBand = useMemo(() => getAgeBandForChild(childAge), [childAge]);
  const localizedBand = localizedAgeBand(ageBand.id, t);
  const ageGames = useMemo(
    () => getGamesForChildAge(childAge).map((game) => localizedResolvedGame(game, t)),
    [childAge, t],
  );
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

  const openGame = useCallback(
    (gameId: (typeof ageGames)[number]["id"], title: string) => {
      navigation.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [
            { name: "ActivitiesMain", params: { segment: "games" } },
            { name: "GamePlay", params: { gameId, title } },
          ],
        }),
      );
    },
    [navigation],
  );

  const openExercise = useCallback(
    (exerciseId: (typeof EXERCISES)[number]["id"], title: string) => {
      navigation.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [
            { name: "ActivitiesMain", params: { segment: "movement" } },
            { name: "ExerciseSession", params: { exerciseId, title } },
          ],
        }),
      );
    },
    [navigation],
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
          {t("child.activities.title")}
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
            <Text style={[styles.segmentText, segment === "games" && styles.segmentTextActive]}>{t("child.activities.segmentLearningGames")}</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, segment === "movement" && styles.segmentBtnActive]}
            onPress={() => setSegment("movement")}
          >
            <Text style={[styles.segmentText, segment === "movement" && styles.segmentTextActive]}>{t("child.activities.movement")}</Text>
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
                  {localizedBand.heroTitle}
                </Text>
                <Text variant="bodySmall" style={styles.sectionHint}>
                  {t("child.activities.gamesHint", {
                    count: ageGames.length,
                    band: localizedBand.label.toLowerCase(),
                    shortLabel: localizedBand.shortLabel,
                  })}
                </Text>
              </View>
            </View>
            <View style={styles.grid}>
              {ageGames.map((game) => (
                <Pressable
                  key={game.id}
                  style={({ pressed }) => [styles.gridItem, styles.gridItemFill, pressed && styles.pressed]}
                  onPress={() => openGame(game.id, game.title)}
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
                  {t("child.activities.movement")}
                </Text>
              </View>
            </View>
            <View style={styles.grid}>
              {EXERCISES.map((ex) => (
                <Pressable
                  key={ex.id}
                  style={({ pressed }) => [styles.gridItem, styles.gridItemFill, pressed && styles.pressed]}
                      onPress={() => openExercise(ex.id, localizedExercise(ex.id, t).title)}
                >
                  <View style={[styles.moveCard, { backgroundColor: c.card, borderColor: c.border }]}>
                    <View style={styles.moveBadge}>
                      <Text style={styles.moveBadgeText}>
                        {t("child.activities.repsStars", { reps: ex.defaultReps, stars: ex.defaultPoints })}
                      </Text>
                    </View>
                    <Text style={styles.moveEmoji}>{ex.emoji}</Text>
                    <Text variant="titleSmall" style={styles.moveTitle} numberOfLines={1}>
                      {localizedExercise(ex.id, t).title}
                    </Text>
                    <Text style={[styles.moveStart, { color: c.primary }]}>{t("child.activities.startLink")}</Text>
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
    sectionHead: { flexDirection: "row", gap: 12, alignItems: "center" },
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
      minHeight: 160,
      borderWidth: 1,
      overflow: "hidden",
      justifyContent: "flex-start",
      gap: 6,
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
    moveEmoji: { fontSize: 32, textAlign: "center", marginTop: 2 },
    moveTitle: { color: c.text, fontWeight: "700", textAlign: "center" },
    moveStart: { fontWeight: "700", marginTop: 4 },
  });
}
