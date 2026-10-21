"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface StartPracticeButtonProps {
  wordCount: number;
}

export function StartPracticeButton({ wordCount }: StartPracticeButtonProps) {
  const router = useRouter();
  const canPractice = wordCount >= 40;

  function handleClick() {
    if (!canPractice) {
      const remaining = 40 - wordCount;
      toast.error(
        `Add at least 40 words to unlock practice (${remaining} more needed).`,
      );
      return;
    }

    router.push("/practice/words/match");
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      variant={canPractice ? "super" : "locked"}
      size="lg"
      className="w-full sm:flex-1 uppercase font-extrabold tracking-wide"
    >
      START +10 XP
    </Button>
  );
}
