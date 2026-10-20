"use client";

import { Badge } from "@/components/ui/badge";
import {
  getGrammarSummaryBadges,
  type GrammarAnalysis,
} from "@/lib/arabic-grammar";
import { cn } from "@/lib/utils";

interface GrammarBadgesProps {
  grammar?: GrammarAnalysis | null;
  className?: string;
  onClick?: () => void;
  interactive?: boolean;
}

export function GrammarBadges({
  grammar,
  className,
  onClick,
  interactive = false,
}: GrammarBadgesProps) {
  if (!grammar || !grammar.part_of_speech) return null;

  const badges = getGrammarSummaryBadges(grammar);
  if (badges.length === 0) return null;

  const posColorMap: Record<string, string> = {
    noun: "border-sky-200 bg-sky-50 text-sky-700",
    verb: "border-indigo-200 bg-indigo-50 text-indigo-700",
    particle: "border-amber-200 bg-amber-50 text-amber-700",
  };

  const posColor =
    posColorMap[grammar.part_of_speech] ||
    "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5",
        interactive && "cursor-pointer transition hover:opacity-85",
        className,
      )}
      onClick={interactive ? onClick : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive && onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {badges.map((badge, idx) => (
        <Badge
          key={badge.id}
          variant="outline"
          className={cn(
            "rounded-lg px-2 py-0.5 text-xs font-semibold tracking-normal transition-colors",
            idx === 0
              ? cn("font-bold shadow-2xs", posColor)
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
          )}
        >
          <span dir="rtl" lang="ar" className="font-arabic">
            {badge.arabic}
          </span>
          <span className="text-slate-300">·</span>
          <span dir="ltr">{badge.english}</span>
        </Badge>
      ))}
    </div>
  );
}
