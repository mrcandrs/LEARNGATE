export type GameId = "alphabet" | "numbers" | "colors" | "shapes" | "math" | "science";

export const CHILD_GAME_CATALOG: { id: GameId; title: string; glyph: string; color: string }[] = [
  { id: "alphabet", title: "Alphabet Adventure", glyph: "ABC", color: "#2196F3" },
  { id: "numbers", title: "Number Train", glyph: "#", color: "#4CAF50" },
  { id: "colors", title: "Color Factory", glyph: "Art", color: "#FF9800" },
  { id: "shapes", title: "Shape Match", glyph: "◇", color: "#9C27B0" },
  { id: "math", title: "Math Challenge", glyph: "+−", color: "#F44336" },
  { id: "science", title: "Science Lab", glyph: "Lab", color: "#009688" },
];
