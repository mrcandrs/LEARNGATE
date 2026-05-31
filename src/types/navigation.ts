import type { NavigatorScreenParams } from "@react-navigation/native";
import type { GameId } from "@/data/childGames";
import type { ExerciseId } from "@/data/exercises";

export type AuthStackParamList = {
  RoleSelect: undefined;
  ParentLogin: undefined;
  ParentSignUp: undefined;
  ChildAccess: undefined;
};

export type ParentTabParamList = {
  Overview: undefined;
  Children: undefined;
  Settings: undefined;
};

export type ChildHomeStackParamList = {
  HomeMain: undefined;
  TasksList: undefined;
  ProfileSettings: undefined;
};

export type ChildActivitiesStackParamList = {
  ActivitiesMain: { segment?: "games" | "movement" } | undefined;
  GamePlay: { gameId: GameId; title: string; taskId?: string };
  ExerciseSession: { taskId?: string; exerciseId: ExerciseId; title: string };
};

export type ChildTabParamList = {
  Home: NavigatorScreenParams<ChildHomeStackParamList> | undefined;
  Activities: NavigatorScreenParams<ChildActivitiesStackParamList> | undefined;
};

export type { GameId };
