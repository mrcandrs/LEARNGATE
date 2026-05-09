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
  Location: undefined;
  Settings: undefined;
  Review: undefined;
};

export type ChildGamesStackParamList = {
  GamesList: undefined;
  GamePlay: { gameId: GameId; title: string; taskId?: string };
};

export type ChildTasksStackParamList = {
  TasksList: undefined;
  ExerciseSession: { taskId: string; exerciseId: ExerciseId; title: string };
};

export type ChildHomeStackParamList = {
  HomeMain: undefined;
};

export type ChildProfileStackParamList = {
  MyStuffMain: undefined;
  ChildSettings: undefined;
};

export type ChildTabParamList = {
  Home: NavigatorScreenParams<ChildHomeStackParamList> | undefined;
  Games: NavigatorScreenParams<ChildGamesStackParamList> | undefined;
  Tasks: NavigatorScreenParams<ChildTasksStackParamList> | undefined;
  MyStuff: NavigatorScreenParams<ChildProfileStackParamList> | undefined;
};

export type { GameId };
