"use client";

import { motion } from "framer-motion";
import {
  Shield,
  CheckCircle2,
  FileCheck,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CoverageRegression } from "@/lib/policy";
import { Card, CardContent } from "@/components/ui/card";

interface CoverageRegressionCardProps {
  regressions: CoverageRegression[];
  className?: string;
}

const METRIC_CONFIG = {
  auth: {
    label: "Auth Coverage",
    icon: Shield,
    description: "Routes with authentication",
  },
  validation: {
    label: "Validation Coverage",
    icon: CheckCircle2,
    description: "Routes with input validation",
  },
  middleware: {
    label: "Middleware Coverage",
    icon: FileCheck,
    description: "Routes protected by middleware",
  },
};

export function CoverageRegressionCard({ regressions, className }: CoverageRegressionCardProps) {
  if (regressions.length === 0) {
    return null;
  }

  const hasRegression = regressions.some((r) => r.isRegression);

  return (
    <Card className={cn(
      "border",
      hasRegression ? "border-yellow-500/30 bg-yellow-500/5" : "border-border",
      className
    )}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Shield className={cn(
            "w-4 h-4",
            hasRegression ? "text-yellow-600 dark:text-yellow-400" : "text-muted-foreground"
          )} />
          <h4 className={cn(
            "text-sm font-medium",
            hasRegression ? "text-yellow-600 dark:text-yellow-400" : "text-muted-foreground"
          )}>
            Coverage Changes
          </h4>
          {hasRegression && (
            <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded">
              Regression Detected
            </span>
          )}
        </div>

        <div className="space-y-3">
          {regressions.map((regression, idx) => {
            const config = METRIC_CONFIG[regression.metric];
            const Icon = config.icon;
            const isImproved = regression.delta > 5;
            const isRegressed = regression.isRegression;

            return (
              <motion.div
                key={regression.metric}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg",
                  isRegressed
                    ? "bg-yellow-500/10 border border-yellow-500/20"
                    : isImproved
                    ? "bg-emerald-500/10 border border-emerald-500/20"
                    : "bg-muted/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn(
                    "w-5 h-5",
                    isRegressed
                      ? "text-yellow-600 dark:text-yellow-400"
                      : isImproved
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                  )} />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {config.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{config.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Baseline */}
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Baseline</p>
                    <p className="text-sm font-medium text-muted-foreground">
                      {Math.round(regression.baseline)}%
                    </p>
                  </div>

                  {/* Arrow */}
                  <div className={cn(
                    "p-1 rounded",
                    isRegressed
                      ? "bg-yellow-500/20"
                      : isImproved
                      ? "bg-emerald-500/20"
                      : "bg-muted"
                  )}>
                    {isRegressed ? (
                      <TrendingDown className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                    ) : isImproved ? (
                      <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Minus className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>

                  {/* Current */}
                  <div className="text-right min-w-[60px]">
                    <p className="text-xs text-muted-foreground">Current</p>
                    <p className={cn(
                      "text-sm font-medium",
                      isRegressed
                        ? "text-yellow-600 dark:text-yellow-400"
                        : isImproved
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-foreground"
                    )}>
                      {Math.round(regression.current)}%
                    </p>
                  </div>

                  {/* Delta */}
                  <div className={cn(
                    "px-2 py-1 rounded text-xs font-medium min-w-[50px] text-center",
                    isRegressed
                      ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                      : isImproved
                      ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {regression.delta > 0 ? "+" : ""}{Math.round(regression.delta)}%
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
