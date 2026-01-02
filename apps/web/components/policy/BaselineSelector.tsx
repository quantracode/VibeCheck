"use client";

import { motion } from "framer-motion";
import {
  FileJson,
  Calendar,
  GitCompare,
  X,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import type { StoredArtifact } from "@/lib/store";

interface BaselineSelectorProps {
  artifacts: StoredArtifact[];
  currentArtifactId: string | null;
  baselineArtifactId: string | null;
  onBaselineChange: (id: string | null) => void;
  className?: string;
}

export function BaselineSelector({
  artifacts,
  currentArtifactId,
  baselineArtifactId,
  onBaselineChange,
  className,
}: BaselineSelectorProps) {
  // Filter out current artifact from baseline options
  const baselineOptions = artifacts.filter((a) => a.id !== currentArtifactId);

  const currentArtifact = artifacts.find((a) => a.id === currentArtifactId);
  const baselineArtifact = artifacts.find((a) => a.id === baselineArtifactId);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card className={cn("border-border", className)}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <GitCompare className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-sm font-medium text-foreground">
            Comparison Setup
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Current Artifact */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wide">
              Current Artifact
            </label>
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              {currentArtifact ? (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <FileJson className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {currentArtifact.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {formatDate(currentArtifact.artifact.generatedAt)}
                    </div>
                  </div>
                  <span className="px-2 py-1 text-xs bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded">
                    Current
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No artifact selected
                </p>
              )}
            </div>
          </div>

          {/* Baseline Artifact */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wide">
              Baseline Artifact
            </label>
            {baselineOptions.length > 0 ? (
              <Select
                value={baselineArtifactId ?? "none"}
                onValueChange={(v) => onBaselineChange(v === "none" ? null : v)}
              >
                <SelectTrigger className="w-full bg-muted/50 border-border">
                  <SelectValue placeholder="Select baseline..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">No baseline (skip regression)</span>
                  </SelectItem>
                  {baselineOptions.map((artifact) => (
                    <SelectItem key={artifact.id} value={artifact.id}>
                      <div className="flex items-center gap-2">
                        <FileJson className="w-3 h-3 text-muted-foreground" />
                        <span className="truncate max-w-[200px]">{artifact.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(artifact.artifact.generatedAt)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="p-3 rounded-lg bg-muted/50 border border-border border-dashed">
                <p className="text-sm text-muted-foreground text-center">
                  Upload another artifact to compare
                </p>
              </div>
            )}

            {baselineArtifact && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-2 rounded bg-muted/30"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <History className="w-3 h-3" />
                  <span>
                    {baselineArtifact.artifact.findings.length} findings in baseline
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onBaselineChange(null)}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </Button>
              </motion.div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
