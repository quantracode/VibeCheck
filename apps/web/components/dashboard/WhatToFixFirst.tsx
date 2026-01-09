"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Sparkles,
  Bot,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/SeverityBadge";
import { cn } from "@/lib/utils";
import type { Finding, Severity } from "@vibecheck/schema";

interface WhatToFixFirstProps {
  findings: Finding[];
  className?: string;
}

const SEVERITY_PRIORITY: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

export function WhatToFixFirst({ findings, className }: WhatToFixFirstProps) {
  // Sort findings by severity and take top 5
  const prioritizedFindings = [...findings]
    .sort((a, b) => SEVERITY_PRIORITY[b.severity] - SEVERITY_PRIORITY[a.severity])
    .slice(0, 5);

  if (prioritizedFindings.length === 0) {
    return (
      <Card className={cn("border-emerald-500/30 bg-emerald-500/5", className)}>
        <CardContent className="py-8 text-center">
          <Sparkles className="w-12 h-12 mx-auto text-emerald-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">All Clear!</h3>
          <p className="text-sm text-muted-foreground">
            No security issues to fix. Your code is looking good.
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasCritical = prioritizedFindings.some((f) => f.severity === "critical");
  const hasHigh = prioritizedFindings.some((f) => f.severity === "high");

  return (
    <Card className={cn(
      hasCritical ? "border-red-500/30" :
      hasHigh ? "border-orange-500/30" :
      "border-primary/30",
      className
    )}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertCircle className={cn(
            "w-5 h-5",
            hasCritical ? "text-red-400" :
            hasHigh ? "text-orange-400" :
            "text-primary"
          )} />
          What to Fix First
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {hasCritical
            ? "You have critical issues that need immediate attention"
            : hasHigh
            ? "These high-priority issues should be addressed soon"
            : "Here are the most important things to address"}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {prioritizedFindings.map((finding, index) => (
          <Link
            key={finding.id}
            href={`/findings/${encodeURIComponent(finding.id)}`}
            className="block group"
          >
            <div className={cn(
              "flex items-start gap-3 p-3 rounded-lg border transition-colors",
              "hover:bg-accent/50 hover:border-accent",
              index === 0 && (hasCritical || hasHigh)
                ? "bg-red-500/5 border-red-500/20"
                : "bg-muted/30 border-muted"
            )}>
              <div className="pt-0.5">
                <SeverityBadge severity={finding.severity} size="sm" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                {/* Plain English Problem */}
                <p className="font-medium text-sm">
                  {finding.enhancements?.plainEnglish?.problem || finding.title}
                </p>
                {/* Category and Rule */}
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <span className="capitalize">{finding.category}</span>
                  <span>•</span>
                  <span className="font-mono">{finding.ruleId}</span>
                  {finding.enhancements?.aiPrompt && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-purple-400">
                        <Bot className="w-3 h-3" />
                        AI help available
                      </span>
                    </>
                  )}
                </p>
                {/* Urgency from enhancements */}
                {finding.enhancements?.severityContext && (
                  <p className={cn(
                    "text-xs",
                    finding.severity === "critical" ? "text-red-400" :
                    finding.severity === "high" ? "text-orange-400" :
                    "text-muted-foreground"
                  )}>
                    {finding.enhancements.severityContext.urgency}
                  </p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
            </div>
          </Link>
        ))}

        {findings.length > 5 && (
          <Link href="/findings" className="block">
            <Button variant="outline" className="w-full">
              View All {findings.length} Findings
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
