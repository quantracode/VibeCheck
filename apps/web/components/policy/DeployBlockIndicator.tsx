"use client";

import { motion } from "framer-motion";
import {
  Ban,
  Rocket,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface DeployBlockIndicatorProps {
  wouldBlock: boolean;
  status: "pass" | "warn" | "fail";
  className?: string;
}

export function DeployBlockIndicator({
  wouldBlock,
  status,
  className,
}: DeployBlockIndicatorProps) {
  return (
    <Card className={cn(
      "border-2",
      wouldBlock
        ? "border-red-500/50 bg-red-500/5"
        : status === "warn"
        ? "border-yellow-500/50 bg-yellow-500/5"
        : "border-emerald-500/50 bg-emerald-500/5",
      className
    )}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className={cn(
              "p-3 rounded-xl",
              wouldBlock
                ? "bg-red-500/20"
                : status === "warn"
                ? "bg-yellow-500/20"
                : "bg-emerald-500/20"
            )}
          >
            {wouldBlock ? (
              <Ban className="w-6 h-6 text-red-400" />
            ) : status === "warn" ? (
              <AlertTriangle className="w-6 h-6 text-yellow-400" />
            ) : (
              <Rocket className="w-6 h-6 text-emerald-400" />
            )}
          </motion.div>

          <div className="flex-1">
            <h4 className={cn(
              "text-lg font-semibold",
              wouldBlock
                ? "text-red-400"
                : status === "warn"
                ? "text-yellow-400"
                : "text-emerald-400"
            )}>
              {wouldBlock
                ? "Would Block Deploy"
                : status === "warn"
                ? "Would Allow with Warnings"
                : "Would Allow Deploy"}
            </h4>
            <p className="text-sm text-muted-foreground">
              {wouldBlock
                ? "This scan result would fail CI/CD gates in a deployment pipeline"
                : status === "warn"
                ? "Deploy would proceed but warnings would be logged"
                : "This scan result would pass all CI/CD quality gates"}
            </p>
          </div>

          <div className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium",
            wouldBlock
              ? "bg-red-500/20 text-red-400"
              : status === "warn"
              ? "bg-yellow-500/20 text-yellow-400"
              : "bg-emerald-500/20 text-emerald-400"
          )}>
            Exit code: {wouldBlock ? 1 : 0}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
