"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { FileCode, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SeverityBadge } from "./SeverityBadge";
import { ConfidenceMeter } from "./ConfidenceMeter";
import { CostAmplificationBadge } from "./AbuseRiskBadge";
import type { Finding } from "@vibecheck/schema";

interface FindingsTableProps {
  findings: Finding[];
  className?: string;
}

export function FindingsTable({ findings, className }: FindingsTableProps) {
  return (
    <div className={cn("space-y-3", className)} role="list" aria-label="Security findings">
      <AnimatePresence mode="popLayout">
        {findings.map((finding, index) => (
          <motion.div
            key={finding.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15, delay: Math.min(index * 0.02, 0.2) }}
            role="listitem"
          >
            <Link
              href={`/findings/${encodeURIComponent(finding.id)}`}
              className={cn(
                "block group border border-border/60 rounded-xl bg-card transition-all duration-200",
                "hover:bg-accent/30 hover:border-primary/20 hover:shadow-elevation-2 hover:-translate-y-0.5",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "shadow-elevation-1"
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
                    </div>

                    <h3 className="font-semibold text-foreground mb-1.5 group-hover:text-primary transition-colors duration-200">
                      {finding.title}
                    </h3>

                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                      {finding.description}
                    </p>

                    {finding.evidence.length > 0 && (
                      <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground/80">
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/30 rounded border border-border/40">
                          <FileCode className="w-3.5 h-3.5" />
                          <span className="font-mono">
                            {finding.evidence[0].file}:{finding.evidence[0].startLine}
                          </span>
                        </div>
                        {finding.evidence.length > 1 && (
                          <span className="text-muted-foreground/60">
                            +{finding.evidence.length - 1} more
                          </span>
                        )}
                      </div>
                    )}
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
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
