"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { FileCode, ChevronRight, Shield, AlertCircle, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { SeverityBadge } from "./SeverityBadge";
import { ConfidenceMeter } from "./ConfidenceMeter";
import { CostAmplificationBadge } from "./AbuseRiskBadge";
import { WhatIfBadge, WhatIfFindingActions } from "./whatif";
import { useWhatIfStore } from "@/lib/whatif-store";
import type { Finding } from "@vibecheck/schema";

interface FindingsTableProps {
  findings: Finding[];
  className?: string;
  /** Set of fingerprints that are waived - used to show waiver indicator */
  waivedFingerprints?: Set<string>;
}

export function FindingsTable({ findings, className, waivedFingerprints }: FindingsTableProps) {
  const { isEnabled: whatIfEnabled, hasOverride } = useWhatIfStore();

  return (
    <div className={cn("space-y-3", className)} role="list" aria-label="Security findings">
      <AnimatePresence mode="popLayout">
        {findings.map((finding, index) => {
          const isWaived = waivedFingerprints?.has(finding.fingerprint);
          const hasWhatIfOverride = whatIfEnabled && hasOverride(finding.id);
          return (
          <motion.div
            key={finding.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15, delay: Math.min(index * 0.02, 0.2) }}
            role="listitem"
          >
            <div
              className={cn(
                "block border border-border/60 rounded-xl bg-card transition-all duration-200",
                "shadow-elevation-1",
                isWaived && "opacity-60 border-emerald-500/30 bg-emerald-500/5",
                hasWhatIfOverride && "border-purple-500/30 bg-purple-500/5"
              )}
            >
              <Link
                href={`/findings/${encodeURIComponent(finding.id)}`}
                className={cn(
                  "block group transition-all duration-200",
                  "hover:bg-accent/30",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                )}
              >
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <SeverityBadge severity={finding.severity} size="sm" />
                      <span className="text-[11px] text-muted-foreground/80 font-mono px-2 py-0.5 bg-muted/50 rounded border border-border/50">
                        {finding.ruleId}
                      </span>
                      <span className="text-[11px] text-muted-foreground px-2 py-0.5 bg-muted/50 rounded border border-border/50 capitalize">
                        {finding.category}
                      </span>
                      {finding.abuseClassification && (
                        <CostAmplificationBadge
                          costAmplification={finding.abuseClassification.costAmplification}
                        />
                      )}
                      {isWaived && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500 font-medium px-2 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/20">
                          <Shield className="w-3 h-3" />
                          Waived
                        </span>
                      )}
                      <WhatIfBadge findingId={finding.id} />
                    </div>

                    <h3 className="font-semibold text-foreground mb-1.5 group-hover:text-primary transition-colors duration-200">
                      {finding.title}
                    </h3>

                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                      {finding.description}
                    </p>

                    {/* Plain English Preview */}
                    {finding.enhancements?.plainEnglish && (
                      <div className="flex items-start gap-2 mt-3 p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20">
                        <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-blue-300/90 line-clamp-1">
                          {finding.enhancements.plainEnglish.problem}
                        </p>
                      </div>
                    )}

                    {/* Enhancement indicators */}
                    <div className="flex items-center gap-2 mt-3">
                      {finding.evidence.length > 0 && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/30 rounded border border-border/40 text-xs text-muted-foreground/80">
                          <FileCode className="w-3.5 h-3.5" />
                          <span className="font-mono">
                            {finding.evidence[0].file}:{finding.evidence[0].startLine}
                          </span>
                          {finding.evidence.length > 1 && (
                            <span className="text-muted-foreground/60">
                              +{finding.evidence.length - 1}
                            </span>
                          )}
                        </div>
                      )}
                      {finding.enhancements?.aiPrompt && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-purple-500/10 rounded border border-purple-500/20 text-xs text-purple-400">
                          <Bot className="w-3 h-3" />
                          <span>AI Help</span>
                        </div>
                      )}
                      {finding.enhancements?.fixSteps && finding.enhancements.fixSteps.length > 0 && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 rounded border border-emerald-500/20 text-xs text-emerald-400">
                          {finding.enhancements.fixSteps.length} steps
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="hidden sm:block w-28">
                      <ConfidenceMeter confidence={finding.confidence} size="sm" />
                    </div>
                    <div className="p-2 rounded-lg bg-muted/30 group-hover:bg-primary/10 transition-colors duration-200">
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
            {whatIfEnabled && (
              <div className="px-5 pb-3 border-t border-border/30 mt-0">
                <WhatIfFindingActions finding={finding} compact />
              </div>
            )}
            </div>
          </motion.div>
        );
        })}
      </AnimatePresence>
    </div>
  );
}
