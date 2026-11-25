"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MIN_PRACTICE_WORDS } from "@/lib/vocabulary/filters";

interface StartPracticeButtonProps {
  wordCount: number;
  href?: string;
  filtered?: boolean;
}

export function StartPracticeButton({ wordCount, href = "/practice/words/match", filtered = false }: StartPracticeButtonProps) {
  const router = useRouter();
  const canPractice = wordCount >= MIN_PRACTICE_WORDS;

  function handleClick() {
    if (!canPractice) {
      const remaining = MIN_PRACTICE_WORDS - wordCount;
      toast.error(
        filtered
          ? `Your filters match ${wordCount} practice words. At least ${MIN_PRACTICE_WORDS} are needed; broaden your filters.`
          : `Add at least ${MIN_PRACTICE_WORDS} words to unlock practice (${remaining} more needed).`,
      );
      return;
    }

    router.push(href);
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      variant={canPractice ? "super" : "locked"}
      size="lg"
      className="w-full sm:flex-1 uppercase font-extrabold tracking-wide"
    >
      {filtered ? `PRACTICE (${wordCount}) +10 XP` : "START +10 XP"}
    </Button>
  );
}
