"use client";

import { motion } from "framer-motion";
import {
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Rocket,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { WhatIfPolicyReport } from "@/lib/whatif-evaluator";

interface WhatIfSimulationBannerProps {
  report: WhatIfPolicyReport;
  className?: string;
}

const STATUS_CONFIG = {
  pass: {
    icon: CheckCircle2,
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-500",
    label: "PASS",
  },
  warn: {
    icon: AlertTriangle,
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    text: "text-yellow-500",
    label: "WARN",
  },
  fail: {
    icon: XCircle,
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-500",
    label: "FAIL",
  },
};

export function WhatIfSimulationBanner({ report, className }: WhatIfSimulationBannerProps) {
  const { whatIf } = report;
  const originalConfig = STATUS_CONFIG[whatIf.originalStatus];
  const newConfig = STATUS_CONFIG[report.status];
  const statusChanged = whatIf.originalStatus !== report.status;
  const wouldUnblock = whatIf.originalStatus === "fail" && report.status !== "fail";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card
        className={cn(
          "border-2 border-dashed border-purple-500/50 bg-purple-500/5",
          className
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <FlaskConical className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                What-If Simulation
                <span className="text-xs font-normal text-muted-foreground">
                  (not saved)
                </span>
              </h3>
              <p className="text-sm text-muted-foreground">
                {whatIf.ignoredByWhatIf} finding{whatIf.ignoredByWhatIf !== 1 ? "s" : ""} ignored,{" "}
                {whatIf.modifiedByWhatIf} modified
              </p>
            </div>
          </div>

          {/* Status comparison */}
          <div className="flex items-center gap-4">
            {/* Original status */}
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border",
                originalConfig.bg,
                originalConfig.border
              )}
            >
              <originalConfig.icon className={cn("w-5 h-5", originalConfig.text)} />
              <div>
                <p className="text-xs text-muted-foreground">Original</p>
                <p className={cn("font-bold", originalConfig.text)}>{originalConfig.label}</p>
              </div>
            </div>

            <ArrowRight className="w-5 h-5 text-muted-foreground" />

            {/* New status */}
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border",
                newConfig.bg,
                newConfig.border,
                statusChanged && "ring-2 ring-offset-2 ring-offset-background",
                statusChanged && report.status === "pass" && "ring-emerald-500",
                statusChanged && report.status === "warn" && "ring-yellow-500"
              )}
            >
              <newConfig.icon className={cn("w-5 h-5", newConfig.text)} />
              <div>
                <p className="text-xs text-muted-foreground">Simulated</p>
                <p className={cn("font-bold", newConfig.text)}>{newConfig.label}</p>
              </div>
            </div>

            {/* Unblock indicator */}
            {wouldUnblock && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30"
              >
                <Rocket className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Deploy</p>
                  <p className="font-semibold text-emerald-500">Unblocked!</p>
                </div>
              </motion.div>
            )}
          </div>

          {/* Reasons changed indicator */}
          {statusChanged && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 text-sm text-muted-foreground"
            >
              {report.status === "pass"
                ? "These changes would make the policy pass."
                : report.status === "warn"
                ? "These changes would reduce failures to warnings."
                : "These changes still result in a failing policy."}
            </motion.p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
