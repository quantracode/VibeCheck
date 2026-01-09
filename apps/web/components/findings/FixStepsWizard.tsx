"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Copy,
  Terminal,
  Check,
  Wand2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FixStep } from "@vibecheck/schema";

interface FixStepsWizardProps {
  steps: FixStep[];
}

export function FixStepsWizard({ steps }: FixStepsWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const step = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const allCompleted = completedSteps.size === steps.length;

  const handleCopy = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const markComplete = () => {
    setCompletedSteps((prev) => new Set([...prev, currentStep]));
    if (!isLastStep) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5" />
            Fix It Step by Step
          </div>
          <span className="text-sm text-muted-foreground font-normal">
            {completedSteps.size} of {steps.length} complete
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2">
          {steps.map((s, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full transition-colors",
                index === currentStep
                  ? "bg-primary text-primary-foreground"
                  : completedSteps.has(index)
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {completedSteps.has(index) ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <span className="text-sm font-medium">{s.step}</span>
              )}
            </button>
          ))}
        </div>

        {/* Current step content */}
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">{step.title}</h3>
            <p className="text-muted-foreground">{step.action}</p>
          </div>

          {/* Code block */}
          {step.code && (
            <div className="relative">
              <pre className="text-sm bg-muted/50 rounded-lg p-4 overflow-x-auto">
                <code className="font-mono">{step.code}</code>
              </pre>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(step.code!, 0)}
                className="absolute top-2 right-2"
              >
                {copiedIndex === 0 ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          )}

          {/* Command block */}
          {step.command && (
            <div className="relative">
              <div className="flex items-center gap-2 bg-zinc-900 rounded-lg p-4">
                <Terminal className="w-4 h-4 text-muted-foreground shrink-0" />
                <code className="text-sm font-mono text-emerald-400">
                  {step.command}
                </code>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(step.command!, 1)}
                className="absolute top-2 right-2"
              >
                {copiedIndex === 1 ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          )}

          {/* Verification */}
          {step.verification && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-blue-400 text-sm uppercase tracking-wide mb-1">
                  How to Verify
                </p>
                <p className="text-sm text-muted-foreground">
                  {step.verification}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="ghost"
            onClick={() => setCurrentStep((prev) => prev - 1)}
            disabled={isFirstStep}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>

          <div className="flex items-center gap-2">
            {!completedSteps.has(currentStep) && (
              <Button
                variant="outline"
                onClick={markComplete}
                className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Mark Complete
              </Button>
            )}

            {!isLastStep && (
              <Button onClick={() => setCurrentStep((prev) => prev + 1)}>
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>

        {/* All done message */}
        {allCompleted && (
          <div className="text-center p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p className="font-medium text-emerald-400">All steps completed!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Run your tests to verify the fix works correctly.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
