"use client";

import { AlertCircle, TrendingDown, Skull } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlainEnglish } from "@vibecheck/schema";

interface PlainEnglishCardProps {
  plainEnglish: PlainEnglish;
}

export function PlainEnglishCard({ plainEnglish }: PlainEnglishCardProps) {
  return (
    <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-blue-400">
          <AlertCircle className="w-5 h-5" />
          What&apos;s Wrong
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* The Problem */}
        <div className="space-y-1">
          <p className="text-lg font-medium text-foreground">
            {plainEnglish.problem}
          </p>
        </div>

        {/* The Impact */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <TrendingDown className="w-5 h-5 text-yellow-400 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-yellow-400 text-sm uppercase tracking-wide mb-1">
              What This Means
            </p>
            <p className="text-sm text-muted-foreground">
              {plainEnglish.impact}
            </p>
          </div>
        </div>

        {/* Worst Case (if provided) */}
        {plainEnglish.worstCase && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <Skull className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-red-400 text-sm uppercase tracking-wide mb-1">
                Worst Case Scenario
              </p>
              <p className="text-sm text-muted-foreground">
                {plainEnglish.worstCase}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
