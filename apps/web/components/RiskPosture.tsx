"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SeverityCounts } from "@vibecheck/schema";

type PolicyThreshold = "critical" | "high" | "medium" | "low" | "info";

const thresholdLabels: Record<PolicyThreshold, string> = {
  critical: "Block on Critical",
  high: "Block on High+",
  medium: "Block on Medium+",
  low: "Block on Low+",
  info: "Block on Any",
};

const thresholdDescriptions: Record<PolicyThreshold, string> = {
  critical: "Only critical findings block deploy",
  high: "High and critical findings block deploy",
  medium: "Medium, high, and critical block deploy",
  low: "Low and above block deploy",
  info: "Any finding blocks deploy",
};

interface RiskPostureProps {
  severityCounts: SeverityCounts;
}

export function RiskPosture({ severityCounts }: RiskPostureProps) {
  const [threshold, setThreshold] = useState<PolicyThreshold>("high");

  const wouldBlock = (() => {
    switch (threshold) {
      case "critical":
        return severityCounts.critical > 0;
      case "high":
        return severityCounts.critical > 0 || severityCounts.high > 0;
      case "medium":
        return (
          severityCounts.critical > 0 ||
          severityCounts.high > 0 ||
          severityCounts.medium > 0
        );
      case "low":
        return (
          severityCounts.critical > 0 ||
          severityCounts.high > 0 ||
          severityCounts.medium > 0 ||
          severityCounts.low > 0
        );
      case "info":
        return (
          severityCounts.critical > 0 ||
          severityCounts.high > 0 ||
          severityCounts.medium > 0 ||
          severityCounts.low > 0 ||
          severityCounts.info > 0
        );
    }
  })();

  const blockingFindings = (() => {
    switch (threshold) {
      case "critical":
        return severityCounts.critical;
      case "high":
        return severityCounts.critical + severityCounts.high;
      case "medium":
        return severityCounts.critical + severityCounts.high + severityCounts.medium;
      case "low":
        return (
          severityCounts.critical +
          severityCounts.high +
          severityCounts.medium +
          severityCounts.low
        );
      case "info":
        return (
          severityCounts.critical +
          severityCounts.high +
          severityCounts.medium +
          severityCounts.low +
          severityCounts.info
        );
    }
  })();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center justify-between">
          <span>Risk Posture</span>
          <Select
            value={threshold}
            onValueChange={(v) => setThreshold(v as PolicyThreshold)}
          >
            <SelectTrigger className="w-[180px] h-8 text-xs" aria-label="Select policy threshold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(thresholdLabels) as PolicyThreshold[]).map((key) => (
                <SelectItem key={key} value={key} className="text-xs">
                  {thresholdLabels[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <AnimatePresence mode="wait">
          <motion.div
            key={wouldBlock ? "block" : "pass"}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "flex items-center gap-4 p-4 rounded-lg",
              wouldBlock
                ? "bg-destructive/10 border border-destructive/20"
                : "bg-success/10 border border-success/20"
            )}
          >
            <div
              className={cn(
                "flex items-center justify-center w-12 h-12 rounded-full",
                wouldBlock ? "bg-destructive/20" : "bg-success/20"
              )}
            >
              {wouldBlock ? (
                <ShieldAlert className="w-6 h-6 text-destructive" />
              ) : (
                <ShieldCheck className="w-6 h-6 text-success" />
              )}
            </div>
            <div className="flex-1">
              <p
                className={cn(
                  "font-semibold",
                  wouldBlock ? "text-destructive" : "text-success"
                )}
              >
                {wouldBlock ? "Deploy Blocked" : "Deploy Allowed"}
              </p>
              <p className="text-sm text-muted-foreground">
                {wouldBlock
                  ? `${blockingFindings} finding${blockingFindings !== 1 ? "s" : ""} exceed${blockingFindings === 1 ? "s" : ""} threshold`
                  : thresholdDescriptions[threshold]}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
