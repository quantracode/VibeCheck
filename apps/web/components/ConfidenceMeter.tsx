"use client";

import { cn } from "@/lib/utils";

interface ConfidenceMeterProps {
  confidence: number;
  showLabel?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function ConfidenceMeter({
  confidence,
  showLabel = true,
  size = "md",
  className,
}: ConfidenceMeterProps) {
  const percentage = Math.round(confidence * 100);

  const getColorClass = () => {
    if (confidence >= 0.8) return "bg-green-500";
    if (confidence >= 0.6) return "bg-yellow-500";
    return "bg-orange-500";
  };

  const barHeight = size === "sm" ? "h-1.5" : "h-2";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "flex-1 bg-muted rounded-full overflow-hidden",
          barHeight
        )}
      >
        <div
          className={cn("h-full rounded-full transition-all", getColorClass())}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className={cn("text-muted-foreground font-medium", textSize)}>
          {percentage}%
        </span>
      )}
    </div>
  );
}
