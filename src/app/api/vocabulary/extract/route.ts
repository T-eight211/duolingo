import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getUserProgress } from "@/db/queries";
import { arabicCourse } from "@/lib/arabic-course";
import {
  extractVocabulary,
  VocabularyExtractionError,
} from "@/lib/vocabulary/extract";
import {
  readVocabularyUpload,
  VocabularyUploadError,
} from "@/lib/vocabulary/upload";
import { analyzeVocabularyGrammar } from "@/lib/grammar/analyze";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json(
        { error: "Sign in to add vocabulary." },
        { status: 401 },
      );

    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json(
        { error: "This upload must come from this site." },
        { status: 403 },
      );
    }

    const progress = await getUserProgress();
    if (progress?.activeCourse?.title !== arabicCourse.title) {
      return NextResponse.json(
        { error: "Select the Arabic course to add vocabulary." },
        { status: 403 },
      );
    }

    const upload = await readVocabularyUpload(request);
    const result = await extractVocabulary(upload, {
      abortSignal: request.signal,
    });

    // Step 4: AI identifies grammatical characteristics using the grammar JSON
    try {
      result.entries = await analyzeVocabularyGrammar(result.entries, {
        abortSignal: request.signal,
      });
    } catch (grammarErr) {
      console.error("Vocabulary grammar analysis failed:", grammarErr);
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (
      error instanceof VocabularyUploadError ||
      error instanceof VocabularyExtractionError
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: "The upload could not be processed. Please try again." },
      { status: 500 },
    );
  }
}
