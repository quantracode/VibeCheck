"use client";

import { cn } from "@/lib/utils";
import type { Severity } from "@vibecheck/schema";

interface SeverityBadgeProps {
  severity: Severity;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const severityConfig: Record<
  Severity,
  { label: string; bgClass: string; textClass: string }
> = {
  critical: {
    label: "Critical",
    bgClass: "bg-severity-critical/15",
    textClass: "text-severity-critical",
  },
  high: {
    label: "High",
    bgClass: "bg-severity-high/15",
    textClass: "text-severity-high",
  },
  medium: {
    label: "Medium",
    bgClass: "bg-severity-medium/15",
    textClass: "text-severity-medium",
  },
  low: {
    label: "Low",
    bgClass: "bg-severity-low/15",
    textClass: "text-severity-low",
  },
  info: {
    label: "Info",
    bgClass: "bg-severity-info/15",
    textClass: "text-severity-info",
  },
};

const sizeClasses = {
  sm: "px-1.5 py-0.5 text-xs",
  md: "px-2 py-1 text-xs",
  lg: "px-2.5 py-1 text-sm",
};

export function SeverityBadge({
  severity,
  size = "md",
  className,
}: SeverityBadgeProps) {
  const config = severityConfig[severity];

  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold rounded-md uppercase tracking-wide",
        config.bgClass,
        config.textClass,
        sizeClasses[size],
        className
      )}
    >
      {config.label}
    </span>
  );
}
