"use client";

import { motion } from "framer-motion";
import {
  FlaskConical,
  EyeOff,
  ArrowDown,
  Folder,
  X,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWhatIfStore } from "@/lib/whatif-store";
import type { WhatIfChange } from "@/lib/whatif-evaluator";
import type { Severity } from "@vibecheck/schema";
import { cn } from "@/lib/utils";

interface WhatIfChangesCardProps {
  changes: WhatIfChange[];
  className?: string;
}

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "text-red-500",
  high: "text-orange-500",
  medium: "text-yellow-500",
  low: "text-blue-500",
  info: "text-slate-500",
};

export function WhatIfChangesCard({ changes, className }: WhatIfChangesCardProps) {
  const { removeOverride, removePathIgnore, clearAllOverrides, pathIgnores } = useWhatIfStore();

  if (changes.length === 0) {
    return null;
  }

  const handleRemove = (change: WhatIfChange) => {
    if (change.type === "path_ignored" && change.pathPattern) {
      // Find the path ignore by pattern
      const pathIgnore = pathIgnores.find((p) => p.pathPattern === change.pathPattern);
      if (pathIgnore) {
        removePathIgnore(pathIgnore.id);
      }
    } else {
      removeOverride(change.findingId);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className={cn("border-purple-500/30", className)}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-purple-500" />
              Simulation Changes
              <span className="text-sm font-normal text-muted-foreground">
                ({changes.length})
              </span>
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllOverrides}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear All
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {changes.map((change, index) => (
            <motion.div
              key={`${change.findingId}-${index}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-start justify-between gap-3 p-3 rounded-lg bg-muted/30 border border-border/50"
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div
                  className={cn(
                    "p-1.5 rounded-lg",
                    change.type === "ignored" && "bg-zinc-500/10",
                    change.type === "severity_changed" && "bg-blue-500/10",
                    change.type === "path_ignored" && "bg-amber-500/10"
                  )}
                >
                  {change.type === "ignored" && (
                    <EyeOff className="w-4 h-4 text-zinc-400" />
                  )}
                  {change.type === "severity_changed" && (
                    <ArrowDown className="w-4 h-4 text-blue-400" />
                  )}
                  {change.type === "path_ignored" && (
                    <Folder className="w-4 h-4 text-amber-400" />
                  )}
                </div>

                {/* Details */}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{change.title}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {change.ruleId}
                  </p>

                  {/* Severity change */}
                  {change.type === "severity_changed" && (
                    <p className="text-xs mt-1">
                      <span className={SEVERITY_COLORS[change.originalSeverity!]}>
                        {change.originalSeverity}
                      </span>
                      <span className="text-muted-foreground mx-1">→</span>
                      <span className={SEVERITY_COLORS[change.newSeverity!]}>
                        {change.newSeverity}
                      </span>
                    </p>
                  )}

                  {/* Path pattern */}
                  {change.type === "path_ignored" && change.pathPattern && (
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      Pattern: {change.pathPattern}
                    </p>
                  )}

                  {/* Reason */}
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    "{change.reason}"
                  </p>
                </div>
              </div>

              {/* Remove button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => handleRemove(change)}
              >
                <X className="w-4 h-4" />
              </Button>
            </motion.div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}
