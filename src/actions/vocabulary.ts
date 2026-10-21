"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import db from "@/db/drizzle";
import { userProgress } from "@/db/schema";

import {
  saveUserVocabulary,
  updateWordCategory,
  updateWordGrammar,
  VocabularyCourseError,
} from "@/db/vocabulary-store";
import { saveVocabularySchema } from "@/lib/vocabulary/schema";
import { arabicGrammarSchema } from "@/lib/grammar/schema";
import { analyzeSingleWordGrammar } from "@/lib/grammar/analyze";
import type { ArabicGrammar } from "@/lib/grammar/types";
import { synthesizeAndUploadWordAudio } from "@/lib/audio/polly";

type SaveVocabularyResult =
  | { success: true; added: number; duplicates: number }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
    };

export async function saveVocabulary(
  input: unknown,
): Promise<SaveVocabularyResult> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: "Sign in to save vocabulary." };
  }

  const parsed = saveVocabularySchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      (fieldErrors[path] ??= []).push(issue.message);
    }
    return {
      success: false,
      error: "Check the highlighted vocabulary before adding it.",
      fieldErrors,
    };
  }

  try {
    const entriesWithCategory = parsed.data.entries.map((entry) => ({
      ...entry,
      category: entry.category ?? parsed.data.category ?? null,
    }));
    const result = await saveUserVocabulary(userId, entriesWithCategory);
    revalidatePath("/practice/words");
    return { success: true, ...result };
  } catch (error) {
    if (error instanceof VocabularyCourseError) {
      return { success: false, error: error.message };
    }
    // The transaction rolls back words and relationships together on failure.
    // Database connection details and uploaded text must not reach the browser.
    return {
      success: false,
      error: "Your vocabulary could not be saved. Please try again.",
    };
  }
}

export async function analyzeWordGrammarAction(params: {
  wordId: string;
  arabic: string;
  arabicDiacritized?: string | null;
  english: string;
  contextSentence?: string | null;
}): Promise<
  | { success: true; grammar: ArabicGrammar; newId?: string }
  | { success: false; error: string }
> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: "Sign in to analyse grammar." };
  }

  try {
    const grammar = await analyzeSingleWordGrammar({
      id: params.wordId,
      arabic: params.arabic,
      arabicDiacritized: params.arabicDiacritized,
      english: params.english,
      contextSentence: params.contextSentence,
    });

    if (!grammar) {
      return {
        success: false,
        error: "Could not analyse the grammar of this word.",
      };
    }

    if (params.wordId.startsWith("starter-")) {
      const generatedId = crypto.randomUUID();
      let audioSrc: string | null = null;
      try {
        audioSrc = await synthesizeAndUploadWordAudio(
          params.arabicDiacritized || params.arabic,
        );
      } catch (e) {
        console.warn("Audio synthesis for starter word skipped:", e);
      }

      await saveUserVocabulary(userId, [
        {
          id: generatedId,
          kind: "word",
          arabic: params.arabic,
          arabicDiacritized: params.arabicDiacritized || params.arabic,
          english: params.english,
          originalArabic: null,
          originalEnglish: null,
          corrections: [],
          needsReview: false,
          reviewReason: null,
          partOfSpeech: grammar.part_of_speech,
          grammar,
          audioSrc,
          sourceIds: [],
        },
      ]);
      revalidatePath("/practice/words");
      return { success: true, grammar, newId: generatedId };
    } else {
      await updateWordGrammar(userId, params.wordId, grammar);
      revalidatePath("/practice/words");
      return { success: true, grammar };
    }
  } catch (err) {
    console.error("analyzeWordGrammarAction error:", err);
    return {
      success: false,
      error: "Grammar analysis failed. Please try again.",
    };
  }
}

export async function saveWordGrammarAction(
  wordId: string,
  grammarInput: unknown,
  wordData?: {
    arabic: string;
    arabicDiacritized?: string | null;
    english: string;
  },
): Promise<{ success: true } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: "Sign in to save grammar." };
  }

  const parsed = arabicGrammarSchema.safeParse(grammarInput);
  if (!parsed.success) {
    return { success: false, error: "Invalid grammar classification data." };
  }

  try {
    if (wordId.startsWith("starter-") && wordData) {
      let audioSrc: string | null = null;
      try {
        audioSrc = await synthesizeAndUploadWordAudio(
          wordData.arabicDiacritized || wordData.arabic,
        );
      } catch (e) {
        console.warn("Audio synthesis for starter word skipped:", e);
      }

      await saveUserVocabulary(userId, [
        {
          id: crypto.randomUUID(),
          kind: "word",
          arabic: wordData.arabic,
          arabicDiacritized: wordData.arabicDiacritized || wordData.arabic,
          english: wordData.english,
          originalArabic: null,
          originalEnglish: null,
          corrections: [],
          needsReview: false,
          reviewReason: null,
          partOfSpeech: parsed.data.part_of_speech,
          grammar: parsed.data as ArabicGrammar,
          audioSrc,
          sourceIds: [],
        },
      ]);
      revalidatePath("/practice/words");
      return { success: true };
    }

    const updated = await updateWordGrammar(
      userId,
      wordId,
      parsed.data as ArabicGrammar,
    );
    if (!updated) {
      return { success: false, error: "Word not found or unauthorized." };
    }
    revalidatePath("/practice/words");
    return { success: true };
  } catch (err) {
    console.error("saveWordGrammarAction error:", err);
    return { success: false, error: "Failed to update grammar." };
  }
}

export async function completeWordPracticeAction(): Promise<{
  success: boolean;
  points?: number;
  error?: string;
}> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: "Sign in to record practice points." };
  }

  try {
    const [progress] = await db
      .select({ points: userProgress.points })
      .from(userProgress)
      .where(eq(userProgress.userId, userId))
      .limit(1);

    if (!progress) {
      return { success: false, error: "User progress not found." };
    }

    const newPoints = progress.points + 10;
    await db
      .update(userProgress)
      .set({ points: newPoints })
      .where(eq(userProgress.userId, userId));

    revalidatePath("/practice/words");
    revalidatePath("/learn");
    revalidatePath("/quests");
    revalidatePath("/leaderboard");

    return { success: true, points: newPoints };
  } catch (err) {
    console.error("completeWordPracticeAction error:", err);
    return { success: false, error: "Failed to record practice points." };
  }
}

export async function updateWordCategoryAction(
  wordId: string,
  category: string | null,
): Promise<{ success: true } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: "Sign in to update category." };
  }

  try {
    const updated = await updateWordCategory(userId, wordId, category);
    if (!updated) {
      return { success: false, error: "Word not found." };
    }
    revalidatePath("/practice/words");
    return { success: true };
  } catch (err) {
    console.error("updateWordCategoryAction error:", err);
    return { success: false, error: "Failed to update category." };
  }
}

