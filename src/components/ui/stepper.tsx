import { Check, Minus } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type StepperProps = {
  steps: { label: string; progress: number; skipped?: boolean }[];
  currentStep: number;
};

// Composed from shadcn/ui Progress; steps indicate progress, not navigation.
export function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <ol aria-label="Exercise progress" className="flex w-full items-start">
      {steps.map((step, index) => {
        const done = step.progress >= 100 && !step.skipped;
        const active = index === currentStep && !done && !step.skipped;
        return (
          <li
            key={step.label}
            aria-current={active ? "step" : undefined}
            className="min-w-0 flex-1"
          >
            <div className="flex items-center">
              <Progress
                value={step.skipped ? 0 : step.progress}
                aria-label={`${step.label} progress`}
                className="h-3 rounded-none first:rounded-s-full [&>div]:duration-500 motion-reduce:[&>div]:transition-none"
              />
              <span
                className={cn(
                  "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors motion-reduce:transition-none",
                  done
                    ? "border-green-500 bg-green-500 text-white"
                    : active
                      ? "border-green-500 bg-green-50 text-green-600"
                      : "border-slate-200 bg-slate-100 text-slate-400",
                )}
              >
                {step.skipped ? (
                  <Minus className="h-4 w-4" aria-hidden="true" />
                ) : done ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  index + 1
                )}
                <span className="sr-only">
                  {step.skipped
                    ? "Skipped"
                    : done
                      ? "Completed"
                      : active
                        ? "Current exercise"
                        : "Upcoming exercise"}
                </span>
              </span>
            </div>
            <p
              className={cn(
                "mt-2 text-center text-xs font-bold",
                active || done ? "text-neutral-700" : "text-slate-400",
              )}
            >
              {step.label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
