"use client";

import { cn } from "@/lib/utils";
import type { Severity } from "@vibecheck/schema";

interface SeverityBadgeProps {
  severity: Severity;
  size?: "sm" | "md" | "lg";
  showDot?: boolean;
  className?: string;
}

const severityConfig: Record<
  Severity,
  { label: string; classes: string }
> = {
  critical: {
    label: "Critical",
    classes: "bg-severity-critical/10 text-severity-critical border-severity-critical/25 shadow-severity-critical/5",
  },
  high: {
    label: "High",
    classes: "bg-severity-high/10 text-severity-high border-severity-high/25 shadow-severity-high/5",
  },
  medium: {
    label: "Medium",
    classes: "bg-severity-medium/10 text-severity-medium border-severity-medium/25 shadow-severity-medium/5",
  },
  low: {
    label: "Low",
    classes: "bg-severity-low/10 text-severity-low border-severity-low/25 shadow-severity-low/5",
  },
  info: {
    label: "Info",
    classes: "bg-severity-info/10 text-severity-info border-severity-info/25 shadow-severity-info/5",
  },
};

const dotColors: Record<Severity, string> = {
  critical: "bg-severity-critical",
  high: "bg-severity-high",
  medium: "bg-severity-medium",
  low: "bg-severity-low",
  info: "bg-severity-info",
};

const sizeClasses = {
  sm: "px-2 py-0.5 text-[10px] gap-1.5",
  md: "px-2.5 py-1 text-xs gap-1.5",
  lg: "px-3 py-1.5 text-sm gap-2",
};

const dotSizes = {
  sm: "w-1.5 h-1.5",
  md: "w-2 h-2",
  lg: "w-2.5 h-2.5",
};

export function SeverityBadge({
  severity,
  size = "md",
  showDot = true,
  className,
}: SeverityBadgeProps) {
  const config = severityConfig[severity];

  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold rounded-md uppercase tracking-wider border shadow-sm transition-colors",
        config.classes,
        sizeClasses[size],
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            "rounded-full shrink-0",
            dotColors[severity],
            dotSizes[size],
            severity === "critical" && "animate-pulse"
          )}
        />
      )}
      {config.label}
    </span>
  );
}
