"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { PolicyReport } from "@/lib/policy";

interface PolicyResultBannerProps {
  report: PolicyReport;
  className?: string;
}

export function PolicyResultBanner({ report, className }: PolicyResultBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusConfig = {
    pass: {
      icon: CheckCircle2,
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      text: "text-emerald-600 dark:text-emerald-500",
      label: "PASS",
      description: "All checks passed",
    },
    warn: {
      icon: AlertTriangle,
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/30",
      text: "text-yellow-600 dark:text-yellow-500",
      label: "WARN",
      description: "Warnings detected",
    },
    fail: {
      icon: XCircle,
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      text: "text-red-600 dark:text-red-500",
      label: "FAIL",
      description: "Policy violations detected",
    },
  };

  const config = statusConfig[report.status];
  const StatusIcon = config.icon;

  const failReasons = report.reasons.filter((r) => r.status === "fail");
  const warnReasons = report.reasons.filter((r) => r.status === "warn");
  const passReasons = report.reasons.filter((r) => r.status === "pass");

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border-2 overflow-hidden",
        config.bg,
        config.border,
        className
      )}
    >
      {/* Main Banner */}
      <div
        className="p-6 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn("p-3 rounded-xl", config.bg)}>
              <StatusIcon className={cn("w-8 h-8", config.text)} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <span className={cn("text-3xl font-bold tracking-tight", config.text)}>
                  {config.label}
                </span>
                {report.profileName && (
                  <span className="px-2 py-1 text-xs font-medium bg-muted rounded-md text-muted-foreground">
                    {report.profileName}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {config.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Summary Stats */}
            <div className="hidden sm:flex items-center gap-6 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {report.summary.total}
                </div>
                <div className="text-xs text-muted-foreground">Active</div>
              </div>
              {report.summary.waived > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-muted-foreground">
                    {report.summary.waived}
                  </div>
                  <div className="text-xs text-muted-foreground">Waived</div>
                </div>
              )}
            </div>

            <button className="p-2 hover:bg-muted/50 rounded-lg transition-colors">
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-border bg-muted/30"
        >
          <div className="p-6 space-y-4">
            {/* Fail Reasons */}
            {failReasons.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  Failures
                </h4>
                {failReasons.map((reason, idx) => (
                  <div
                    key={idx}
                    className="pl-6 py-2 text-sm text-foreground/80 border-l-2 border-red-500/50"
                  >
                    <p>{reason.message}</p>
                    {reason.findingIds && reason.findingIds.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Findings: {reason.findingIds.slice(0, 5).join(", ")}
                        {reason.findingIds.length > 5 && ` +${reason.findingIds.length - 5} more`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Warn Reasons */}
            {warnReasons.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Warnings
                </h4>
                {warnReasons.map((reason, idx) => (
                  <div
                    key={idx}
                    className="pl-6 py-2 text-sm text-foreground/80 border-l-2 border-yellow-500/50"
                  >
                    <p>{reason.message}</p>
                    {reason.findingIds && reason.findingIds.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Findings: {reason.findingIds.slice(0, 5).join(", ")}
                        {reason.findingIds.length > 5 && ` +${reason.findingIds.length - 5} more`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Pass Reasons */}
            {passReasons.length > 0 && report.status === "pass" && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Passed Checks
                </h4>
                {passReasons.map((reason, idx) => (
                  <div
                    key={idx}
                    className="pl-6 py-2 text-sm text-foreground/80 border-l-2 border-emerald-500/50"
                  >
                    {reason.message}
                  </div>
                ))}
              </div>
            )}

            {/* Thresholds */}
            <div className="pt-4 border-t border-border">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4" />
                Active Thresholds
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-muted-foreground">Fail on</div>
                  <div className="text-foreground font-medium capitalize">
                    {report.thresholds.failOnSeverity}+
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-muted-foreground">Warn on</div>
                  <div className="text-foreground font-medium capitalize">
                    {report.thresholds.warnOnSeverity}+
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-muted-foreground">Min confidence</div>
                  <div className="text-foreground font-medium">
                    {Math.round(report.thresholds.minConfidenceForFail * 100)}%
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-muted-foreground">Regression policy</div>
                  <div className="text-foreground font-medium">
                    {report.regressionPolicy.failOnNewHighCritical ? "Strict" : "Lenient"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
