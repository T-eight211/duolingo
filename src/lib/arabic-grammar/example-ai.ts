import "server-only";

import { createGateway, generateText, Output, type LanguageModel } from "ai";
import { GrammarAiTransportSchema } from "./ai-transport";
import { GrammarSchema, type GrammarAnalysis } from "./schema";
import type { GrammarIssue } from "./validate-paths";

export interface GrammarAnalysisResult {
  draft: GrammarAnalysis;
  isValid: boolean;
  errors?: GrammarIssue[];
}

export function getArabicGrammarModel(): LanguageModel {
  const apiKey = process.env.VERCEL_AI_GATEWAY_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("VERCEL_AI_GATEWAY_API_KEY is not configured.");
  }
  const gateway = createGateway({ apiKey });
  const modelId =
    process.env.ARABIC_GRAMMAR_MODEL ||
    process.env.VOCABULARY_AI_MODEL ||
    "google/gemini-2.5-flash";
  return gateway(modelId);
}

/**
 * Server-side AI call for analysing the Arabic grammar of an extracted word.
 * Uses GrammarAiTransportSchema for model generation, then GrammarSchema.safeParse
 * for cross-field path validation. Does NOT auto-persist to database.
 */
export async function analyzeArabicGrammar(
  word: string,
  contextSentence?: string | null,
  options: { model?: LanguageModel; abortSignal?: AbortSignal } = {},
): Promise<GrammarAnalysisResult> {
  const model = options.model ?? getArabicGrammarModel();

  const prompt = [
    `Analyse the Arabic grammar of the following word in Modern Standard Arabic (العربية الفصحى): "${word}".`,
    contextSentence
      ? `Sentence context: "${contextSentence}".`
      : "No sentence context provided (isolated word).",
    "Adhere strictly to the grammatical schema. Do not invent missing characteristics. Never output the literal string 'none'.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await generateText({
    model,
    output: Output.object({ schema: GrammarAiTransportSchema }),
    prompt,
    abortSignal: options.abortSignal,
  });

  const draft = response.output;
  const validation = GrammarSchema.safeParse(draft);

  if (!validation.success) {
    const errors: GrammarIssue[] = validation.error.issues.map((iss) => ({
      path: iss.path as Array<string | number>,
      message: iss.message,
    }));
    return { draft, isValid: false, errors };
  }

  return { draft: validation.data, isValid: true };
}
