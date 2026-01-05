"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Package, AlertTriangle, FileCode, ArrowRight, ShieldAlert, Lock, Users, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "./SeverityBadge";
import type { Finding, Severity } from "@vibecheck/schema";

interface SupplyChainCardProps {
  findings: Finding[];
  className?: string;
}

interface SupplyChainFinding {
  finding: Finding;
  ruleId: string;
  ruleLabel: string;
  icon: typeof Package;
}

const RULE_INFO: Record<string, { label: string; icon: typeof Package }> = {
  "VC-SUP-001": { label: "Install Scripts", icon: Bot },
  "VC-SUP-002": { label: "Version Ranges", icon: Lock },
  "VC-SUP-003": { label: "Deprecated Package", icon: ShieldAlert },
  "VC-SUP-004": { label: "Multiple Auth", icon: Users },
  "VC-SUP-005": { label: "Suspicious Scripts", icon: AlertTriangle },
};

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

export function SupplyChainCard({ findings, className }: SupplyChainCardProps) {
  // Filter supply-chain findings
  const supplyChainFindings = useMemo<SupplyChainFinding[]>(() => {
    return findings
      .filter((f) => f.category === "supply-chain")
      .map((f) => ({
        finding: f,
        ruleId: f.ruleId,
        ruleLabel: RULE_INFO[f.ruleId]?.label ?? f.ruleId,
        icon: RULE_INFO[f.ruleId]?.icon ?? Package,
      }))
      .sort((a, b) => {
        // Sort by severity
        return SEVERITY_ORDER[b.finding.severity] - SEVERITY_ORDER[a.finding.severity];
      });
  }, [findings]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    const byRule: Record<string, number> = {};

    for (const f of supplyChainFindings) {
      bySeverity[f.finding.severity]++;
      byRule[f.ruleId] = (byRule[f.ruleId] || 0) + 1;
    }

    return {
      total: supplyChainFindings.length,
      bySeverity,
      byRule,
      hasCriticalOrHigh: bySeverity.critical > 0 || bySeverity.high > 0,
    };
  }, [supplyChainFindings]);

  if (supplyChainFindings.length === 0) {
    return null;
  }

  return (
    <Card className={cn("border-purple-500/30 bg-purple-500/5", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="w-5 h-5 text-purple-400" />
          <span>Supply Chain Security</span>
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            {stats.total} issue{stats.total !== 1 ? "s" : ""}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Severity Summary */}
        <div className="grid grid-cols-5 gap-2 text-center">
          {(["critical", "high", "medium", "low", "info"] as const).map((level) => {
            const count = stats.bySeverity[level];
            const colors = {
              critical: "text-red-400 bg-red-500/10",
              high: "text-orange-400 bg-orange-500/10",
              medium: "text-yellow-400 bg-yellow-500/10",
              low: "text-blue-400 bg-blue-500/10",
              info: "text-slate-400 bg-slate-500/10",
            };
            return (
              <div
                key={level}
                className={cn(
                  "rounded-lg py-2 px-3",
                  count > 0 ? colors[level] : "bg-muted/50 text-muted-foreground"
                )}
              >
                <p className="text-lg font-bold">{count}</p>
                <p className="text-[10px] uppercase tracking-wide opacity-80">{level}</p>
              </div>
            );
          })}
        </div>

        {/* Warning for Critical/High */}
        {stats.hasCriticalOrHigh && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <AlertTriangle className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="text-purple-400 font-medium">Supply Chain Risks Detected</p>
              <p className="text-muted-foreground mt-0.5">
                Your project has dependencies with known vulnerabilities, deprecated packages,
                or suspicious install scripts. Review these findings promptly.
              </p>
            </div>
          </div>
        )}

        {/* Top Findings */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Top Issues
          </p>
          {supplyChainFindings.slice(0, 4).map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.finding.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link
                  href={`/findings/${encodeURIComponent(item.finding.id)}`}
                  className="block p-3 rounded-lg border border-border/50 bg-card hover:bg-accent/50 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <SeverityBadge severity={item.finding.severity} size="sm" />
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-purple-500/10 text-purple-400 rounded">
                          <Icon className="w-3 h-3" />
                          {item.ruleLabel}
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                        {item.finding.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                        <FileCode className="w-3 h-3" />
                        <span className="font-mono truncate">
                          {item.finding.evidence[0]?.file}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 mt-1" />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* View All Link */}
        {supplyChainFindings.length > 4 && (
          <Link href="/findings?category=supply-chain">
            <Button variant="outline" size="sm" className="w-full">
              View all {supplyChainFindings.length} supply chain issues
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
