import type { NavigatorScreenParams } from "@react-navigation/native";
import type { GameId } from "@/data/childGames";
import type { ExerciseId } from "@/data/exercises";
import type { LegalDocumentId } from "@/content/legalDocuments";

export type LegalDocumentParams = { documentId: LegalDocumentId };

export type AuthStackParamList = {
  RoleSelect: undefined;
  ParentLogin: { notice?: string; email?: string } | undefined;
  ParentSignUp: undefined;
  ChildAccess: undefined;
  LegalDocument: LegalDocumentParams;
};

/** Optional params when opening a tab from the notification bell or a push tap. */
export type ParentOverviewParams = {
  childId?: string;
  expandInsights?: boolean;
  focusUnlockRequests?: boolean;
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

export type ParentStackParamList = {
  ParentTabs: NavigatorScreenParams<ParentTabParamList> | undefined;
  LegalDocument: LegalDocumentParams;
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
