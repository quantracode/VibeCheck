"use client";

import { motion } from "framer-motion";
import {
  Plus,
  Minus,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RegressionSummary as RegressionData } from "@/lib/policy";
import { Card, CardContent } from "@/components/ui/card";

interface RegressionSummaryProps {
  regression: RegressionData;
  className?: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-purple-400",
  high: "text-red-400",
  medium: "text-yellow-400",
  low: "text-blue-400",
  info: "text-zinc-400",
};

export function RegressionSummary({ regression, className }: RegressionSummaryProps) {
  const hasChanges =
    regression.newFindings.length > 0 ||
    regression.resolvedFindings.length > 0 ||
    regression.severityRegressions.length > 0;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* New Findings */}
        <Card className={cn(
          "border",
          regression.newFindings.length > 0 ? "border-red-500/30 bg-red-500/5" : "border-zinc-800"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">New</p>
                <p className={cn(
                  "text-2xl font-bold",
                  regression.newFindings.length > 0 ? "text-red-400" : "text-zinc-400"
                )}>
                  {regression.newFindings.length}
                </p>
              </div>
              <Plus className={cn(
                "w-5 h-5",
                regression.newFindings.length > 0 ? "text-red-400" : "text-zinc-600"
              )} />
            </div>
          </CardContent>
        </Card>

        {/* Resolved Findings */}
        <Card className={cn(
          "border",
          regression.resolvedFindings.length > 0 ? "border-emerald-500/30 bg-emerald-500/5" : "border-zinc-800"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Resolved</p>
                <p className={cn(
                  "text-2xl font-bold",
                  regression.resolvedFindings.length > 0 ? "text-emerald-400" : "text-zinc-400"
                )}>
                  {regression.resolvedFindings.length}
                </p>
              </div>
              <Minus className={cn(
                "w-5 h-5",
                regression.resolvedFindings.length > 0 ? "text-emerald-400" : "text-zinc-600"
              )} />
            </div>
          </CardContent>
        </Card>

        {/* Persisting */}
        <Card className="border border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Persisting</p>
                <p className="text-2xl font-bold text-zinc-300">
                  {regression.persistingCount}
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-zinc-600" />
            </div>
          </CardContent>
        </Card>

        {/* Net Change */}
        <Card className={cn(
          "border",
          regression.netChange > 0
            ? "border-red-500/30 bg-red-500/5"
            : regression.netChange < 0
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-zinc-800"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Net Change</p>
                <p className={cn(
                  "text-2xl font-bold",
                  regression.netChange > 0
                    ? "text-red-400"
                    : regression.netChange < 0
                    ? "text-emerald-400"
                    : "text-zinc-400"
                )}>
                  {regression.netChange > 0 ? "+" : ""}{regression.netChange}
                </p>
              </div>
              {regression.netChange > 0 ? (
                <TrendingUp className="w-5 h-5 text-red-400" />
              ) : regression.netChange < 0 ? (
                <TrendingDown className="w-5 h-5 text-emerald-400" />
              ) : (
                <ArrowRight className="w-5 h-5 text-zinc-600" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Severity Regressions */}
      {regression.severityRegressions.length > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <h4 className="text-sm font-medium text-yellow-400">
                Severity Regressions ({regression.severityRegressions.length})
              </h4>
            </div>
            <div className="space-y-2">
              {regression.severityRegressions.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center gap-3 p-2 rounded-lg bg-zinc-900/50"
                >
                  <ArrowUpRight className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">
                      {item.title}
                    </p>
                    <p className="text-xs text-zinc-500">{item.ruleId}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={SEVERITY_COLORS[item.previousSeverity]}>
                      {item.previousSeverity}
                    </span>
                    <ArrowRight className="w-3 h-3 text-zinc-600" />
                    <span className={SEVERITY_COLORS[item.currentSeverity]}>
                      {item.currentSeverity}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Findings List */}
      {regression.newFindings.length > 0 && (
        <Card className="border-red-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Plus className="w-4 h-4 text-red-400" />
              <h4 className="text-sm font-medium text-red-400">
                New Findings ({regression.newFindings.length})
              </h4>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {regression.newFindings.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="flex items-center gap-3 p-2 rounded-lg bg-zinc-900/50"
                >
                  <span className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0",
                    item.severity === "critical" && "bg-purple-500",
                    item.severity === "high" && "bg-red-500",
                    item.severity === "medium" && "bg-yellow-500",
                    item.severity === "low" && "bg-blue-500",
                    item.severity === "info" && "bg-zinc-500"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 truncate">{item.title}</p>
                    <p className="text-xs text-zinc-500">{item.ruleId}</p>
                  </div>
                  <span className={cn("text-xs capitalize", SEVERITY_COLORS[item.severity])}>
                    {item.severity}
                  </span>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resolved Findings List */}
      {regression.resolvedFindings.length > 0 && (
        <Card className="border-emerald-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <h4 className="text-sm font-medium text-emerald-400">
                Resolved Findings ({regression.resolvedFindings.length})
              </h4>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {regression.resolvedFindings.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="flex items-center gap-3 p-2 rounded-lg bg-zinc-900/50"
                >
                  <span className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0",
                    item.severity === "critical" && "bg-purple-500",
                    item.severity === "high" && "bg-red-500",
                    item.severity === "medium" && "bg-yellow-500",
                    item.severity === "low" && "bg-blue-500",
                    item.severity === "info" && "bg-zinc-500"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 truncate line-through opacity-60">
                      {item.title}
                    </p>
                    <p className="text-xs text-zinc-500">{item.ruleId}</p>
                  </div>
                  <span className={cn("text-xs capitalize opacity-60", SEVERITY_COLORS[item.severity])}>
                    {item.severity}
                  </span>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Changes */}
      {!hasChanges && (
        <Card className="border-zinc-800">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p className="text-zinc-400">No changes detected from baseline</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
