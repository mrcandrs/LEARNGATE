import type { NavigatorScreenParams } from "@react-navigation/native";
import type { GameId } from "@/data/childGames";
import type { ExerciseId } from "@/data/exercises";

export type AuthStackParamList = {
  RoleSelect: undefined;
  ParentLogin: undefined;
  ParentSignUp: undefined;
  ChildAccess: undefined;
};

/** Optional params when opening a tab from the notification bell or a push tap. */
export type ParentOverviewParams = {
  childId?: string;
  expandInsights?: boolean;
  navKey?: number;
};

export type ParentChildrenParams = {
  childId?: string;
  focusSubmissions?: boolean;
  navKey?: number;
};

export type ParentTabParamList = {
  Overview: ParentOverviewParams | undefined;
  Children: ParentChildrenParams | undefined;
  Settings: undefined;
};

export type ChildHomeStackParamList = {
  HomeMain: undefined;
  TasksList: { navKey?: number } | undefined;
  ProfileSettings: undefined;
};

export type ChildActivitiesStackParamList = {
  ActivitiesMain: { segment?: "games" | "movement"; navKey?: number } | undefined;
  GamePlay: { gameId: GameId; title: string; taskId?: string };
  ExerciseSession: { taskId?: string; exerciseId: ExerciseId; title: string };
};

export type ChildTabParamList = {
  Home: NavigatorScreenParams<ChildHomeStackParamList> | undefined;
  Activities: NavigatorScreenParams<ChildActivitiesStackParamList> | undefined;
};

export type { GameId };
