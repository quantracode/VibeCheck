"use client";

import { useState } from "react";
import { Code, ChevronDown, ChevronUp, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CodeComparison } from "@vibecheck/schema";

interface CodeComparisonCardProps {
  codeComparison: CodeComparison;
}

export function CodeComparisonCard({ codeComparison }: CodeComparisonCardProps) {
  const [showChanges, setShowChanges] = useState(false);
  const hasChanges = codeComparison.changes && codeComparison.changes.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Code className="w-5 h-5" />
          Before & After
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Before */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-red-400 uppercase tracking-wide">
                Current (Vulnerable)
              </span>
            </div>
            <pre className={cn(
              "text-xs rounded-lg p-4 overflow-x-auto border",
              "bg-red-500/5 border-red-500/20"
            )}>
              <code className="text-red-300/90 font-mono">
                {codeComparison.before}
              </code>
            </pre>
          </div>

          {/* After */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-emerald-400 uppercase tracking-wide">
                Fixed (Secure)
              </span>
            </div>
            <pre className={cn(
              "text-xs rounded-lg p-4 overflow-x-auto border",
              "bg-emerald-500/5 border-emerald-500/20"
            )}>
              <code className="text-emerald-300/90 font-mono">
                {codeComparison.after}
              </code>
            </pre>
          </div>
        </div>

        {/* Changes Explanation */}
        {hasChanges && (
          <div className="space-y-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowChanges(!showChanges)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Info className="w-4 h-4 mr-2" />
              What changed?
              {showChanges ? (
                <ChevronUp className="w-4 h-4 ml-2" />
              ) : (
                <ChevronDown className="w-4 h-4 ml-2" />
              )}
            </Button>

            {showChanges && (
              <div className="space-y-2 pl-4 border-l-2 border-muted">
                {codeComparison.changes!.map((change, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <span className="font-mono text-emerald-400 shrink-0">
                      Line {change.line}:
                    </span>
                    <span className="text-muted-foreground">
                      {change.explanation}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Language indicator */}
        <div className="flex justify-end">
          <span className="text-xs text-muted-foreground font-mono">
            {codeComparison.language}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
