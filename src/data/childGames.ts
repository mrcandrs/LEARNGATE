export type GameId = "alphabet" | "numbers" | "colors" | "shapes" | "math" | "science";

export const CHILD_GAME_CATALOG: { id: GameId; title: string; glyph: string; color: string; blurb: string }[] = [
  {
    id: "alphabet",
    title: "Alphabet Adventure",
    glyph: "ABC",
    color: "#2196F3",
    blurb: "Letters, vowels & word sounds",
  },
  {
    id: "numbers",
    title: "Number Train",
    glyph: "#",
    color: "#4CAF50",
    blurb: "Counting & number patterns",
  },
  {
    id: "colors",
    title: "Color Factory",
    glyph: "Art",
    color: "#FF9800",
    blurb: "Colors, mixes & warm/cool",
  },
  {
    id: "shapes",
    title: "Shape Match",
    glyph: "◇",
    color: "#9C27B0",
    blurb: "Shapes, sides & corners",
  },
  {
    id: "math",
    title: "Math Challenge",
    glyph: "+−",
    color: "#F44336",
    blurb: "Add, subtract & multiply",
  },
  {
    id: "science",
    title: "Science Lab",
    glyph: "Lab",
    color: "#009688",
    blurb: "Science facts & quizzes",
  },
];
