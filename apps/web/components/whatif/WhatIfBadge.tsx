"use client";

import { FlaskConical, EyeOff, ArrowDown, Shield } from "lucide-react";
import { useWhatIfStore, type WhatIfAction } from "@/lib/whatif-store";
import { cn } from "@/lib/utils";

interface WhatIfBadgeProps {
  findingId: string;
  className?: string;
  showLabel?: boolean;
}

const ACTION_CONFIG: Record<WhatIfAction, { label: string; icon: typeof FlaskConical; color: string }> = {
  ignore: {
    label: "Ignored",
    icon: EyeOff,
    color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  },
  downgrade: {
    label: "Downgraded",
    icon: ArrowDown,
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  waive: {
    label: "Waived",
    icon: Shield,
    color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  },
};

export function WhatIfBadge({ findingId, className, showLabel = true }: WhatIfBadgeProps) {
  const { isEnabled, getOverride } = useWhatIfStore();

  if (!isEnabled) return null;

  const override = getOverride(findingId);
  if (!override) return null;

  const config = ACTION_CONFIG[override.action];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
        config.color,
        className
      )}
      title={`Simulation: ${config.label} - ${override.reason}`}
    >
      <FlaskConical className="w-3 h-3" />
      {showLabel && config.label}
    </span>
  );
}
