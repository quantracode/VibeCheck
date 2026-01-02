"use client";

import { cn } from "@/lib/utils";
import { Zap, AlertTriangle, Flame, Skull } from "lucide-react";
import type { AbuseRisk, AbuseCategory } from "@vibecheck/schema";

interface AbuseRiskBadgeProps {
  risk: AbuseRisk;
  category?: AbuseCategory;
  costAmplification?: number;
  size?: "sm" | "md" | "lg";
  showCost?: boolean;
  className?: string;
}

const riskConfig: Record<AbuseRisk, {
  label: string;
  icon: typeof Zap;
  className: string;
  bgClassName: string;
}> = {
  critical: {
    label: "Critical",
    icon: Skull,
    className: "text-red-400",
    bgClassName: "bg-red-500/10 border-red-500/30",
  },
  high: {
    label: "High",
    icon: Flame,
    className: "text-orange-400",
    bgClassName: "bg-orange-500/10 border-orange-500/30",
  },
  medium: {
    label: "Medium",
    icon: AlertTriangle,
    className: "text-yellow-400",
    bgClassName: "bg-yellow-500/10 border-yellow-500/30",
  },
  low: {
    label: "Low",
    icon: Zap,
    className: "text-blue-400",
    bgClassName: "bg-blue-500/10 border-blue-500/30",
  },
};

const categoryLabels: Record<AbuseCategory, string> = {
  ai_generation: "AI Generation",
  code_execution: "Code Execution",
  file_processing: "File Processing",
  external_api: "External API",
  computation: "Computation",
  data_export: "Data Export",
  upload_processing: "Upload Processing",
};

const sizeClasses = {
  sm: "text-[10px] px-1.5 py-0.5 gap-1",
  md: "text-xs px-2 py-1 gap-1.5",
  lg: "text-sm px-3 py-1.5 gap-2",
};

const iconSizes = {
  sm: "w-2.5 h-2.5",
  md: "w-3 h-3",
  lg: "w-4 h-4",
};

export function AbuseRiskBadge({
  risk,
  category,
  costAmplification,
  size = "md",
  showCost = true,
  className,
}: AbuseRiskBadgeProps) {
  const config = riskConfig[risk];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center font-medium rounded-md border",
        sizeClasses[size],
        config.bgClassName,
        config.className,
        className
      )}
      title={category ? `Abuse Risk: ${config.label} - ${categoryLabels[category]}` : `Abuse Risk: ${config.label}`}
    >
      <Icon className={iconSizes[size]} />
      <span>Abuse Risk</span>
      {showCost && costAmplification && costAmplification > 1 && (
        <span className="font-mono opacity-80">
          {costAmplification}x
        </span>
      )}
    </div>
  );
}

/**
 * Compact cost amplification indicator
 */
export function CostAmplificationBadge({
  costAmplification,
  className,
}: {
  costAmplification: number;
  className?: string;
}) {
  if (costAmplification <= 1) return null;

  const severity = costAmplification >= 100 ? "critical" :
                   costAmplification >= 50 ? "high" :
                   costAmplification >= 20 ? "medium" : "low";

  const colorClass = {
    critical: "text-red-400 bg-red-500/10 border-red-500/30",
    high: "text-orange-400 bg-orange-500/10 border-orange-500/30",
    medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
    low: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  }[severity];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border",
        colorClass,
        className
      )}
      title={`Cost amplification: ${costAmplification}x per request`}
    >
      <Zap className="w-2.5 h-2.5" />
      {costAmplification}x
    </span>
  );
}

/**
 * Inline abuse category label
 */
export function AbuseCategoryLabel({
  category,
  className,
}: {
  category: AbuseCategory;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30",
        className
      )}
    >
      {categoryLabels[category]}
    </span>
  );
}
