"use client";

import { Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SeverityContext, Severity } from "@vibecheck/schema";

interface SeverityContextCardProps {
  severityContext: SeverityContext;
  severity: Severity;
}

const URGENCY_STYLES: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  "Fix immediately before deploying": {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
    icon: "text-red-400",
  },
  "Fix before next release": {
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    text: "text-orange-400",
    icon: "text-orange-400",
  },
  "Should fix soon": {
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    text: "text-yellow-400",
    icon: "text-yellow-400",
  },
  "Good to fix eventually": {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-400",
    icon: "text-blue-400",
  },
  "Nice to have": {
    bg: "bg-gray-500/10",
    border: "border-gray-500/30",
    text: "text-gray-400",
    icon: "text-gray-400",
  },
};

export function SeverityContextCard({ severityContext, severity }: SeverityContextCardProps) {
  const styles = URGENCY_STYLES[severityContext.urgency] || URGENCY_STYLES["Nice to have"];
  const isUrgent = severity === "critical" || severity === "high";

  return (
    <div className={cn(
      "rounded-lg border p-4",
      styles.bg,
      styles.border
    )}>
      <div className="flex items-start gap-3">
        {isUrgent ? (
          <AlertTriangle className={cn("w-5 h-5 mt-0.5 shrink-0", styles.icon)} />
        ) : (
          <Clock className={cn("w-5 h-5 mt-0.5 shrink-0", styles.icon)} />
        )}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={cn("font-semibold", styles.text)}>
              {severityContext.urgency}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {severityContext.reasoning}
          </p>
        </div>
      </div>
    </div>
  );
}
