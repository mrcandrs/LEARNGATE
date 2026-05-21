import type { DifficultyTier } from "@/data/gameDifficulty";

/** Words for alphabet / phonics-style prompts (first letter only). */
export const WORDS_BY_FIRST_LETTER: Record<string, string[]> = {
  A: ["Apple", "Ant"],
  B: ["Ball", "Bear"],
  C: ["Cat", "Cup"],
  D: ["Dog", "Duck"],
  E: ["Egg", "Elephant"],
  F: ["Fish", "Fan"],
  G: ["Goat", "Gift"],
  H: ["Hat", "House"],
  I: ["Igloo", "Ice"],
  J: ["Jam", "Jet"],
  K: ["Kite", "King"],
  L: ["Lion", "Leaf"],
  M: ["Moon", "Milk"],
  N: ["Nest", "Nose"],
  O: ["Orange", "Owl"],
  P: ["Pen", "Pig"],
  Q: ["Queen", "Quilt"],
  R: ["Rain", "Rose"],
  S: ["Sun", "Star"],
  T: ["Tree", "Toy"],
  U: ["Umbrella", "Up"],
  V: ["Van", "Violet"],
  W: ["Water", "Wolf"],
  X: ["X-ray", "Box"],
  Y: ["Yellow", "Yak"],
  Z: ["Zoo", "Zip"],
};

export const VOWELS = new Set(["A", "E", "I", "O", "U"]);

export const SCIENCE_TRUE_FALSE = {
  easy: [
    { q: "The sun helps plants grow.", a: true },
    { q: "Fish live in water.", a: true },
    { q: "Ice is frozen water.", a: true },
    { q: "We see with our eyes.", a: true },
    { q: "Birds have feathers.", a: true },
    { q: "The moon is made of cheese.", a: false },
    { q: "Rain comes from clouds.", a: true },
    { q: "Trees are living things.", a: true },
    { q: "A puppy is a baby dog.", a: true },
    { q: "Fire is very cold.", a: false },
  ],
  medium: [
    { q: "The sun is a star.", a: true },
    { q: "Fish breathe air like humans do.", a: false },
    { q: "Plants need sunlight to make food.", a: true },
    { q: "The moon makes its own light.", a: false },
    { q: "Magnets can pull some metals.", a: true },
    { q: "A day has 24 hours.", a: true },
    { q: "Sound travels faster than light.", a: false },
    { q: "Recycling helps the environment.", a: true },
    { q: "All rocks are the same.", a: false },
    { q: "Exercise helps keep your body healthy.", a: true },
  ],
  hard: [
    { q: "Water boils at about 100°C at sea level.", a: true },
    { q: "Earth is the third planet from the Sun.", a: true },
    { q: "Lightning is a form of electricity.", a: true },
    { q: "Dinosaurs still walk the Earth today.", a: false },
    { q: "The heart pumps blood through the body.", a: true },
    { q: "Friction can slow moving objects.", a: true },
    { q: "The North Star is a planet.", a: false },
    { q: "Bacteria are always bad for you.", a: false },
    { q: "Seasons happen because Earth is tilted.", a: true },
    { q: "Fossil fuels come from ancient plants and animals.", a: true },
  ],
} as const;

export const SCIENCE_MULTIPLE_CHOICE = {
  easy: [
    { q: "What do plants need from the sun?", choices: ["Light", "Sound", "Metal", "Salt"], answer: "Light" },
    { q: "Where do fish live?", choices: ["Water", "Desert", "Sky", "Space"], answer: "Water" },
    { q: "Which sense do we use to hear?", choices: ["Ears", "Eyes", "Nose", "Hands"], answer: "Ears" },
    { q: "What season is usually the coldest?", choices: ["Winter", "Summer", "Spring", "Fall"], answer: "Winter" },
    { q: "What do bees make?", choices: ["Honey", "Milk", "Juice", "Sand"], answer: "Honey" },
  ],
  medium: [
    { q: "Which part of a plant takes in water?", choices: ["Roots", "Leaves", "Flowers", "Fruit"], answer: "Roots" },
    { q: "Which planet do we live on?", choices: ["Mars", "Earth", "Venus", "Jupiter"], answer: "Earth" },
    { q: "What gas do people need to breathe?", choices: ["Oxygen", "Helium", "Smoke", "Steam"], answer: "Oxygen" },
    { q: "Which tool measures temperature?", choices: ["Thermometer", "Ruler", "Clock", "Scale"], answer: "Thermometer" },
    { q: "What is H₂O?", choices: ["Water", "Gold", "Air", "Wood"], answer: "Water" },
    { q: "Which animal is a mammal?", choices: ["Dolphin", "Shark", "Frog", "Snake"], answer: "Dolphin" },
    { q: "What pulls objects toward Earth?", choices: ["Gravity", "Wind", "Rain", "Light"], answer: "Gravity" },
    { q: "Which organ pumps blood?", choices: ["Heart", "Lung", "Stomach", "Brain"], answer: "Heart" },
  ],
  hard: [
    { q: "What is the center of our solar system?", choices: ["The Sun", "The Moon", "Earth", "Mars"], answer: "The Sun" },
    { q: "Which state of matter is ice?", choices: ["Solid", "Liquid", "Gas", "Plasma"], answer: "Solid" },
    { q: "What do we call animals that eat only plants?", choices: ["Herbivores", "Carnivores", "Omnivores", "Predators"], answer: "Herbivores" },
    { q: "Which layer protects Earth from too much UV light?", choices: ["Ozone layer", "Crust", "Mantle", "Core"], answer: "Ozone layer" },
    { q: "What type of energy comes from the Sun?", choices: ["Solar", "Nuclear", "Coal", "Wind"], answer: "Solar" },
    { q: "Which gas do plants release during photosynthesis?", choices: ["Oxygen", "Carbon dioxide", "Helium", "Smoke"], answer: "Oxygen" },
    { q: "What is the hardest natural material on Earth?", choices: ["Diamond", "Wood", "Rubber", "Paper"], answer: "Diamond" },
    { q: "Which scientist studied gravity and motion?", choices: ["Newton", "Picasso", "Shakespeare", "Mozart"], answer: "Newton" },
  ],
} as const;

/** Color mix prompts — answer must match a choice label. */
export const COLOR_MIX_CHALLENGES = [
  { prompt: "RED + BLUE makes which color?", answer: "PURPLE", pool: ["PURPLE", "GREEN", "ORANGE", "YELLOW"] },
  { prompt: "RED + YELLOW makes which color?", answer: "ORANGE", pool: ["ORANGE", "GREEN", "PURPLE", "BLUE"] },
  { prompt: "BLUE + YELLOW makes which color?", answer: "GREEN", pool: ["GREEN", "PURPLE", "RED", "ORANGE"] },
] as const;

export const COLOR_CATEGORY_CHALLENGES = [
  { prompt: "Which is a warm color?", answer: "RED", pool: ["RED", "BLUE", "GREEN", "PURPLE"] },
  { prompt: "Which is a cool color?", answer: "BLUE", pool: ["BLUE", "RED", "YELLOW", "ORANGE"] },
  { prompt: "Which color is the sky on a sunny day?", answer: "BLUE", pool: ["BLUE", "RED", "GREEN", "PURPLE"] },
  { prompt: "Which color do we often see on grass?", answer: "GREEN", pool: ["GREEN", "PURPLE", "RED", "YELLOW"] },
] as const;

/** Counting prompts for Number Train (no + − ×). */
export const COUNTING_SCENARIOS = [
  { prompt: "How many apples? 🍎🍎🍎", answer: 3 },
  { prompt: "How many stars? ⭐⭐", answer: 2 },
  { prompt: "How many ducks? 🦆🦆🦆🦆", answer: 4 },
  { prompt: "How many balls? ⚽⚽⚽⚽⚽", answer: 5 },
  { prompt: "How many flowers? 🌸🌸🌸🌸🌸🌸", answer: 6 },
  { prompt: "How many moons? 🌙", answer: 1 },
  { prompt: "How many cats? 🐱🐱🐱🐱🐱🐱🐱", answer: 7 },
  { prompt: "How many trees? 🌳🌳🌳🌳🌳🌳🌳🌳", answer: 8 },
] as const;

export function sciencePoolForTier(tier: DifficultyTier): readonly { q: string; a: boolean }[] {
  return SCIENCE_TRUE_FALSE[tier];
}

export function scienceMcqPoolForTier(tier: DifficultyTier) {
  return SCIENCE_MULTIPLE_CHOICE[tier];
}
