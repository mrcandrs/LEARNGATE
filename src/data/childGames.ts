import type { ComponentProps } from "react";
import type { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  getAgeBandForAge,
  normalizeChildAge,
  type AgeBandId,
} from "@/data/childAgeBands";

export type GameId = "alphabet" | "numbers" | "colors" | "shapes" | "math" | "science";

type GameIcon = ComponentProps<typeof MaterialCommunityIcons>["name"];

export type GameBandCopy = {
  title: string;
  teaser: string;
  blurb: string;
  playCta: string;
  badge?: string;
};

export type ChildGameDefinition = {
  id: GameId;
  /** Default title when no band override */
  title: string;
  glyph: string;
  color: string;
  icon: GameIcon;
  ageBands: AgeBandId[];
  /** Lower = shown first within a band */
  bandOrder: Partial<Record<AgeBandId, number>>;
  bandCopy: Partial<Record<AgeBandId, GameBandCopy>>;
  defaultBlurb: string;
};

/** Single source of truth for all learning games and age targeting. */
export const CHILD_GAME_DEFINITIONS: ChildGameDefinition[] = [
  {
    id: "alphabet",
    title: "Alphabet Adventure",
    glyph: "ABC",
    color: "#2196F3",
    icon: "alphabetical",
    ageBands: ["preschooler", "pupil"],
    bandOrder: { preschooler: 1, pupil: 4 },
    defaultBlurb: "Letters, vowels & word sounds",
    bandCopy: {
      preschooler: {
        title: "Letter Safari",
        teaser: "Hunt for letters!",
        blurb: "Meet the ABCs with friendly sounds and pictures",
        playCta: "Go on safari",
        badge: "New letters",
      },
      pupil: {
        title: "Word Wizard",
        teaser: "Spell & read!",
        blurb: "Boost reading with vowels, blends, and word clues",
        playCta: "Cast a spell",
        badge: "Reading",
      },
    },
  },
  {
    id: "numbers",
    title: "Number Train",
    glyph: "123",
    color: "#4CAF50",
    icon: "numeric",
    ageBands: ["preschooler", "pupil", "adolescent"],
    bandOrder: { preschooler: 2, pupil: 2, adolescent: 3 },
    defaultBlurb: "Counting & number patterns",
    bandCopy: {
      preschooler: {
        title: "Counting Crew",
        teaser: "Choo-choo count!",
        blurb: "Count objects and hop along the number train",
        playCta: "All aboard",
        badge: "Counting",
      },
      pupil: {
        title: "Number Navigator",
        teaser: "Crack the code!",
        blurb: "Patterns, sequences, and smarter number tricks",
        playCta: "Navigate",
        badge: "Patterns",
      },
      adolescent: {
        title: "Speed Numbers",
        teaser: "Think fast!",
        blurb: "Rapid-fire number challenges for sharp minds",
        playCta: "Race the clock",
        badge: "Speed",
      },
    },
  },
  {
    id: "colors",
    title: "Color Factory",
    glyph: "🎨",
    color: "#FF9800",
    icon: "palette",
    ageBands: ["preschooler", "pupil"],
    bandOrder: { preschooler: 3, pupil: 5 },
    defaultBlurb: "Colors, mixes & warm/cool",
    bandCopy: {
      preschooler: {
        title: "Rainbow Paint",
        teaser: "Splash colors!",
        blurb: "Mix paints and name every color of the rainbow",
        playCta: "Start painting",
        badge: "Colors",
      },
      pupil: {
        title: "Color Logic",
        teaser: "Mix & match!",
        blurb: "Warm vs cool, mixes, and color brain-teasers",
        playCta: "Mix it up",
        badge: "Logic",
      },
    },
  },
  {
    id: "shapes",
    title: "Shape Match",
    glyph: "◇",
    color: "#9C27B0",
    icon: "puzzle-outline",
    ageBands: ["preschooler", "pupil", "adolescent"],
    bandOrder: { preschooler: 4, pupil: 3, adolescent: 4 },
    defaultBlurb: "Shapes, sides & corners",
    bandCopy: {
      preschooler: {
        title: "Shape Squad",
        teaser: "Spot the shape!",
        blurb: "Circles, squares, and stars — match them all",
        playCta: "Join the squad",
        badge: "Shapes",
      },
      pupil: {
        title: "Pattern Pro",
        teaser: "Find the pattern!",
        blurb: "Sides, corners, and shape patterns that level up",
        playCta: "Find patterns",
        badge: "Patterns",
      },
      adolescent: {
        title: "Geometry Quest",
        teaser: "Master shapes!",
        blurb: "Angles, symmetry, and geometry-style puzzles",
        playCta: "Start quest",
        badge: "Geometry",
      },
    },
  },
  {
    id: "math",
    title: "Math Challenge",
    glyph: "+−",
    color: "#F44336",
    icon: "calculator-variant",
    ageBands: ["pupil", "adolescent"],
    bandOrder: { pupil: 1, adolescent: 1 },
    defaultBlurb: "Add, subtract & multiply",
    bandCopy: {
      pupil: {
        title: "Math Mission",
        teaser: "Mission math!",
        blurb: "Add and subtract your way through fun missions",
        playCta: "Accept mission",
        badge: "Math",
      },
      adolescent: {
        title: "Brain Booster Math",
        teaser: "Level up math!",
        blurb: "Multiply, divide, and tackle tougher problems",
        playCta: "Boost brain",
        badge: "Challenge",
      },
    },
  },
  {
    id: "science",
    title: "Science Lab",
    glyph: "🔬",
    color: "#009688",
    icon: "flask",
    ageBands: ["pupil", "adolescent"],
    bandOrder: { pupil: 6, adolescent: 2 },
    defaultBlurb: "Science facts & quizzes",
    bandCopy: {
      pupil: {
        title: "Discovery Den",
        teaser: "Explore science!",
        blurb: "Animals, plants, and wow-facts about our world",
        playCta: "Discover",
        badge: "Science",
      },
      adolescent: {
        title: "Lab Legends",
        teaser: "Experiment time!",
        blurb: "Earth, space, body science, and true-or-false labs",
        playCta: "Enter lab",
        badge: "Lab",
      },
    },
  },
];

export type ResolvedChildGame = {
  id: GameId;
  title: string;
  glyph: string;
  color: string;
  icon: GameIcon;
  teaser: string;
  blurb: string;
  playCta: string;
  badge?: string;
  ageBand: AgeBandId;
  sortOrder: number;
};

function resolveGameForBand(game: ChildGameDefinition, bandId: AgeBandId): ResolvedChildGame {
  const copy = game.bandCopy[bandId];
  return {
    id: game.id,
    title: copy?.title ?? game.title,
    glyph: game.glyph,
    color: game.color,
    icon: game.icon,
    teaser: copy?.teaser ?? "Let's play!",
    blurb: copy?.blurb ?? game.defaultBlurb,
    playCta: copy?.playCta ?? "Play now",
    badge: copy?.badge,
    ageBand: bandId,
    sortOrder: game.bandOrder[bandId] ?? 99,
  };
}

export function getGameDefinition(gameId: GameId): ChildGameDefinition | undefined {
  return CHILD_GAME_DEFINITIONS.find((g) => g.id === gameId);
}

/** Games appropriate for the child's age, with band-specific catchy copy. */
export function getGamesForChildAge(age: number | null | undefined): ResolvedChildGame[] {
  const normalized = normalizeChildAge(age);
  const bandId = getAgeBandForAge(normalized);
  return CHILD_GAME_DEFINITIONS.filter((g) => g.ageBands.includes(bandId))
    .map((g) => resolveGameForBand(g, bandId))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getRecommendedGamesForChildAge(
  age: number | null | undefined,
  limit = 2
): ResolvedChildGame[] {
  return getGamesForChildAge(age).slice(0, limit);
}

export function isGameAllowedForChildAge(gameId: GameId, age: number | null | undefined): boolean {
  return getGamesForChildAge(age).some((g) => g.id === gameId);
}

/** @deprecated Use getGamesForChildAge — kept for imports that need the full list shape */
export const CHILD_GAME_CATALOG = CHILD_GAME_DEFINITIONS.map((g) => ({
  id: g.id,
  title: g.title,
  glyph: g.glyph,
  color: g.color,
  blurb: g.defaultBlurb,
}));
