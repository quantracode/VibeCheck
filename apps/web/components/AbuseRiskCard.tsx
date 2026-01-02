"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Zap, AlertTriangle, FileCode, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AbuseRiskBadge, AbuseCategoryLabel } from "./AbuseRiskBadge";
import type { Finding, AbuseRisk } from "@vibecheck/schema";

interface AbuseRiskCardProps {
  findings: Finding[];
  className?: string;
}

interface AbuseEndpoint {
  finding: Finding;
  risk: AbuseRisk;
  costAmplification: number;
  missingControls: string[];
}

const RISK_ORDER: Record<AbuseRisk, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function AbuseRiskCard({ findings, className }: AbuseRiskCardProps) {
  // Extract and sort abuse-risk findings
  const abuseEndpoints = useMemo<AbuseEndpoint[]>(() => {
    return findings
      .filter((f) => f.abuseClassification)
      .map((f) => ({
        finding: f,
        risk: f.abuseClassification!.risk,
        costAmplification: f.abuseClassification!.costAmplification,
        missingControls: f.abuseClassification!.missingEnforcement,
      }))
      .sort((a, b) => {
        // Sort by risk level, then by cost amplification
        const riskDiff = RISK_ORDER[b.risk] - RISK_ORDER[a.risk];
        if (riskDiff !== 0) return riskDiff;
        return b.costAmplification - a.costAmplification;
      });
  }, [findings]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const byRisk = { critical: 0, high: 0, medium: 0, low: 0 };
    let totalCost = 0;

    for (const ep of abuseEndpoints) {
      byRisk[ep.risk]++;
      totalCost += ep.costAmplification;
    }

    return {
      total: abuseEndpoints.length,
      byRisk,
      avgCost: abuseEndpoints.length > 0 ? Math.round(totalCost / abuseEndpoints.length) : 0,
      maxCost: Math.max(...abuseEndpoints.map((e) => e.costAmplification), 0),
    };
  }, [abuseEndpoints]);

  if (abuseEndpoints.length === 0) {
    return null;
  }

  return (
    <Card className={cn("border-orange-500/30 bg-orange-500/5", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Zap className="w-5 h-5 text-orange-400" />
          <span>Compute Abuse Risk</span>
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            {stats.total} endpoint{stats.total !== 1 ? "s" : ""}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Risk Summary */}
        <div className="grid grid-cols-4 gap-2 text-center">
          {(["critical", "high", "medium", "low"] as const).map((level) => {
            const count = stats.byRisk[level];
            const colors = {
              critical: "text-red-400 bg-red-500/10",
              high: "text-orange-400 bg-orange-500/10",
              medium: "text-yellow-400 bg-yellow-500/10",
              low: "text-blue-400 bg-blue-500/10",
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

        {/* Cost Warning */}
        {stats.maxCost >= 50 && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="text-orange-400 font-medium">High Cost Amplification Detected</p>
              <p className="text-muted-foreground mt-0.5">
                Maximum {stats.maxCost}x cost per request. Unprotected endpoints may result in
                significant financial damage.
              </p>
            </div>
          </div>
        )}

        {/* Top Risky Endpoints */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Highest Risk Endpoints
          </p>
          {abuseEndpoints.slice(0, 3).map((ep, index) => (
            <motion.div
              key={ep.finding.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                href={`/findings/${encodeURIComponent(ep.finding.id)}`}
                className="block p-3 rounded-lg border border-border/50 bg-card hover:bg-accent/50 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <AbuseRiskBadge
                        risk={ep.risk}
                        costAmplification={ep.costAmplification}
                        size="sm"
                      />
                      {ep.finding.abuseClassification && (
                        <AbuseCategoryLabel category={ep.finding.abuseClassification.category} />
                      )}
                    </div>
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {ep.finding.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                      <FileCode className="w-3 h-3" />
                      <span className="font-mono truncate">
                        {ep.finding.evidence[0]?.file}:{ep.finding.evidence[0]?.startLine}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 mt-1" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* View All Link */}
        {abuseEndpoints.length > 3 && (
          <Link href="/findings?category=abuse">
            <Button variant="outline" size="sm" className="w-full">
              View all {abuseEndpoints.length} abuse-risk endpoints
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
