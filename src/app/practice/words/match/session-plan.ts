export type WordPair = {
  id: string;
  english: string;
  arabic: string;
  audioSrc?: string | null;
  errorCount?: number;
  correctCount?: number;
};

export type ExerciseType =
  | "audio_en"
  | "audio_ar"
  | "en_ar_cascade"
  | "en_ar_static"
  | "en_ar_no_audio";

export type ExerciseSlotKind = "audio" | "english" | "arabic";

export interface ExerciseStagePlan {
  type: ExerciseType;
  title: string;
  subtitle?: string;
  isListening: boolean;
  hasAudio: boolean;
  leftKind: ExerciseSlotKind;
  rightKind: ExerciseSlotKind;
  totalCount: number;
  initialSlots: number;
  hasRefill: boolean;
  initialPairs: WordPair[];
  extraPairs: WordPair[];
  initialLeftSlots: WordPair[];
  initialRightSlots: WordPair[];
}

export interface SessionPlan {
  stages: ExerciseStagePlan[];
}

export function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Weighted shuffle based on A-Res weighted random sampling:
 * Words with higher errorCount receive higher weights and appear more frequently.
 * Words with 0 errors stay at baseline weight 1, so learned words appear less frequently.
 */
export function weightedShuffle<T extends { errorCount?: number }>(
  items: T[],
): T[] {
  return [...items]
    .map((item) => {
      const errorCount = Math.max(0, item.errorCount ?? 0);
      const weight = 1 + errorCount * 2.5;
      const u = Math.max(1e-6, Math.random());
      const key = Math.pow(u, 1 / weight);
      return { item, key };
    })
    .sort((a, b) => b.key - a.key)
    .map((entry) => entry.item);
}

export const ALL_EXERCISE_TYPES: ExerciseType[] = [
  "audio_en",
  "audio_ar",
  "en_ar_cascade",
  "en_ar_static",
  "en_ar_no_audio",
];

export function getStagePairCounts(type: ExerciseType): {
  initial: number;
  swaps: number;
} {
  switch (type) {
    case "en_ar_static":
      return { initial: 5, swaps: 0 };
    case "en_ar_no_audio":
      return { initial: 5, swaps: 16 };
    default:
      return { initial: 5, swaps: 8 };
  }
}

export function createExerciseStage(
  type: ExerciseType,
  pool: WordPair[],
): ExerciseStagePlan {
  const { initial, swaps } = getStagePairCounts(type);
  const initialPairs = pool.slice(0, initial);
  const extraPairs = swaps > 0 ? pool.slice(initial, initial + swaps) : [];
  const initialLeftSlots = shuffle(initialPairs);
  const initialRightSlots = shuffle(initialPairs);

  const base = {
    type,
    totalCount: initialPairs.length + extraPairs.length,
    initialSlots: initial,
    hasRefill: swaps > 0,
    initialPairs,
    extraPairs,
    initialLeftSlots,
    initialRightSlots,
  };

  switch (type) {
    case "audio_en":
      return {
        ...base,
        title: "Tap the matching pairs",
        subtitle: "Match each audio clip with its English translation.",
        isListening: true,
        hasAudio: true,
        leftKind: "audio",
        rightKind: "english",
      };
    case "audio_ar":
      return {
        ...base,
        title: "Tap the matching pairs",
        subtitle: "Match each audio clip with its Arabic text.",
        isListening: true,
        hasAudio: true,
        leftKind: "audio",
        rightKind: "arabic",
      };
    case "en_ar_static":
      return {
        ...base,
        title: "Tap the matching pairs",
        subtitle: "Match each English word with its Arabic translation.",
        isListening: false,
        hasAudio: true,
        leftKind: "english",
        rightKind: "arabic",
      };
    case "en_ar_no_audio":
      return {
        ...base,
        title: "Tap the matching pairs",
        subtitle: "Match each English word with its Arabic translation.",
        isListening: false,
        hasAudio: false,
        leftKind: "english",
        rightKind: "arabic",
      };
    case "en_ar_cascade":
    default:
      return {
        ...base,
        type: "en_ar_cascade",
        title: "Tap the matching pairs",
        subtitle:
          "Match the pairs to reveal new words. Keep going until all are matched.",
        isListening: false,
        hasAudio: true,
        leftKind: "english",
        rightKind: "arabic",
      };
  }
}

export function createSessionPlan(words: WordPair[]): SessionPlan {
  // Always pick 3 distinct exercise types in a mixed/randomized order
  const selectedTypes = shuffle(ALL_EXERCISE_TYPES).slice(0, 3);

  // Each stage draws from the vocabulary pool with weighted priority for error-prone words
  const stages: ExerciseStagePlan[] = selectedTypes.map((type) => {
    const { initial, swaps } = getStagePairCounts(type);
    const count = initial + swaps;
    const prioritizedWords = weightedShuffle(words);
    const pool = prioritizedWords.slice(0, count);
    return createExerciseStage(type, pool);
  });

  return { stages };
}
