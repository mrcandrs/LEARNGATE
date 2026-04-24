import type { NavigatorScreenParams } from "@react-navigation/native";
import type { GameId } from "@/data/childGames";

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
  Review: undefined;
};

export type ChildGamesStackParamList = {
  GamesList: undefined;
  GamePlay: { gameId: GameId; title: string };
};

export type ChildTabParamList = {
  Home: undefined;
  Games: NavigatorScreenParams<ChildGamesStackParamList> | undefined;
  Tasks: undefined;
  MyStuff: undefined;
};

export type { GameId };
