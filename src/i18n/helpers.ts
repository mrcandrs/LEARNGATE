import type { AchievementCategory } from "@/data/achievements";
import type { AgeBandId } from "@/data/childAgeBands";
import type { ExerciseId } from "@/data/exercises";
import type { ResolvedChildGame } from "@/data/childGames";
import type { TranslateParams, TranslationKey } from "@/i18n/types";

export type TranslateFn = (key: TranslationKey, params?: TranslateParams) => string;

export function localizedExercise(id: ExerciseId, t: TranslateFn) {
  return {
    title: t(`exercises.${id}.title`),
    cardDescription: t(`exercises.${id}.cardDescription`),
  };
}

export function localizedAchievementCategory(category: AchievementCategory, t: TranslateFn) {
  return t(`achievements.categories.${category}`);
}

export function localizedAgeBand(bandId: AgeBandId, t: TranslateFn) {
  return {
    label: t(`ageBands.${bandId}.label`),
    shortLabel: t(`ageBands.${bandId}.shortLabel`),
    heroTitle: t(`ageBands.${bandId}.heroTitle`),
    heroSubtitle: t(`ageBands.${bandId}.heroSubtitle`),
    gamesHint: t(`ageBands.${bandId}.gamesHint`),
  };
}

export function localizedResolvedGame(game: ResolvedChildGame, t: TranslateFn): ResolvedChildGame {
  const titleKey = `games.${game.id}.${game.ageBand}.title` as TranslationKey;
  const title = t(titleKey);
  if (title === titleKey) {
    return game;
  }
  return {
    ...game,
    title,
    teaser: t(`games.${game.id}.${game.ageBand}.teaser` as TranslationKey),
    blurb: t(`games.${game.id}.${game.ageBand}.blurb` as TranslationKey),
    playCta: t(`games.${game.id}.${game.ageBand}.playCta` as TranslationKey),
    badge: game.badge ? t(`games.${game.id}.${game.ageBand}.badge` as TranslationKey) : game.badge,
  };
}
