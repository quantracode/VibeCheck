"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EyeOff, ArrowDown, Shield, X, FlaskConical, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useWhatIfStore, getLowerSeverity, type WhatIfAction } from "@/lib/whatif-store";
import type { Finding, Severity } from "@vibecheck/schema";
import { cn } from "@/lib/utils";

interface WhatIfFindingActionsProps {
  finding: Finding;
  className?: string;
  compact?: boolean;
}

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "text-red-500",
  high: "text-orange-500",
  medium: "text-yellow-500",
  low: "text-blue-500",
  info: "text-slate-500",
};

export function WhatIfFindingActions({ finding, className, compact = false }: WhatIfFindingActionsProps) {
  const { isEnabled, addOverride, removeOverride, hasOverride, getOverride } = useWhatIfStore();
  const [showReasonInput, setShowReasonInput] = useState<WhatIfAction | null>(null);
  const [reason, setReason] = useState("");
  const [targetSeverity, setTargetSeverity] = useState<Severity>(getLowerSeverity(finding.severity));

  if (!isEnabled) return null;

  const existingOverride = getOverride(finding.id);
  const hasExistingOverride = !!existingOverride;

  const handleAction = (action: WhatIfAction) => {
    if (action === "downgrade") {
      setTargetSeverity(getLowerSeverity(finding.severity));
    }
    setReason("");
    setShowReasonInput(action);
  };

  const confirmAction = () => {
    if (!showReasonInput || !reason.trim()) return;

    addOverride({
      findingId: finding.id,
      fingerprint: finding.fingerprint,
      action: showReasonInput,
      newSeverity: showReasonInput === "downgrade" ? targetSeverity : undefined,
      reason: reason.trim(),
    });

    setShowReasonInput(null);
    setReason("");
  };

  const cancelAction = () => {
    setShowReasonInput(null);
    setReason("");
  };

  // If there's an existing override, show undo button
  if (hasExistingOverride) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <span className="text-xs text-muted-foreground">
          {existingOverride.action === "ignore" && "Ignored in simulation"}
          {existingOverride.action === "downgrade" && `Downgraded to ${existingOverride.newSeverity}`}
          {existingOverride.action === "waive" && "Waived in simulation"}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => removeOverride(finding.id)}
          className="h-6 px-2 text-xs"
        >
          <X className="w-3 h-3 mr-1" />
          Undo
        </Button>
      </div>
    );
  }

  // Show action input form
  if (showReasonInput) {
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className={cn("flex flex-col gap-2", className)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {showReasonInput === "ignore" && "Ignore this finding:"}
            {showReasonInput === "downgrade" && (
              <>
                Downgrade to{" "}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-5 px-1 font-medium">
                      <span className={SEVERITY_COLORS[targetSeverity]}>{targetSeverity}</span>
                      <ChevronDown className="w-3 h-3 ml-0.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {(["high", "medium", "low", "info"] as Severity[])
                      .filter((s) => s !== finding.severity)
                      .map((severity) => (
                        <DropdownMenuItem
                          key={severity}
                          onClick={() => setTargetSeverity(severity)}
                        >
                          <span className={cn("capitalize", SEVERITY_COLORS[severity])}>
                            {severity}
                          </span>
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
            {showReasonInput === "waive" && "Waive this finding:"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Reason for simulation..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-8 text-xs"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmAction();
              if (e.key === "Escape") cancelAction();
            }}
          />
          <Button size="sm" className="h-8" onClick={confirmAction} disabled={!reason.trim()}>
            Apply
          </Button>
          <Button variant="ghost" size="sm" className="h-8" onClick={cancelAction}>
            Cancel
          </Button>
        </div>
      </motion.div>
    );
  }

  // Show action dropdown
  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className={cn("h-7 px-2", className)}>
            <FlaskConical className="w-3.5 h-3.5 mr-1" />
            Simulate
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="flex items-center gap-1.5 text-xs">
            <FlaskConical className="w-3 h-3 text-purple-500" />
            What-If Actions
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleAction("ignore")}>
            <EyeOff className="w-4 h-4 mr-2" />
            Ignore Finding
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleAction("downgrade")}
            disabled={finding.severity === "info"}
          >
            <ArrowDown className="w-4 h-4 mr-2" />
            Downgrade Severity
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAction("waive")}>
            <Shield className="w-4 h-4 mr-2" />
            Waive by Fingerprint
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Full action buttons
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => handleAction("ignore")}
      >
        <EyeOff className="w-3.5 h-3.5 mr-1" />
        Ignore
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => handleAction("downgrade")}
        disabled={finding.severity === "info"}
      >
        <ArrowDown className="w-3.5 h-3.5 mr-1" />
        Downgrade
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => handleAction("waive")}
      >
        <Shield className="w-3.5 h-3.5 mr-1" />
        Waive
      </Button>
    </div>
  );
}
