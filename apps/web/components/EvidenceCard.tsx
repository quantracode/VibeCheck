"use client";

import { FileCode, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EvidenceItem } from "@vibecheck/schema";

interface EvidenceCardProps {
  evidence: EvidenceItem;
  className?: string;
}

export function EvidenceCard({ evidence, className }: EvidenceCardProps) {
  const lineRange =
    evidence.startLine === evidence.endLine
      ? `L${evidence.startLine}`
      : `L${evidence.startLine}-${evidence.endLine}`;

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden bg-card",
        className
      )}
    >
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
        <div className="flex items-center gap-2 text-sm">
          <FileCode className="w-4 h-4 text-muted-foreground" />
          <span className="font-mono text-foreground">{evidence.file}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
          <Hash className="w-3 h-3" />
          {lineRange}
        </div>
      </div>

      <div className="p-4">
        <p className="text-sm text-muted-foreground mb-2">{evidence.label}</p>

        {evidence.snippet && (
          <pre className="text-sm bg-muted/50 rounded p-3 overflow-x-auto">
            <code>{evidence.snippet}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
