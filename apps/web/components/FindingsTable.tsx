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
    <div className={cn("space-y-2", className)} role="list" aria-label="Security findings">
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
                "block group border rounded-lg bg-card transition-all",
                "hover:bg-accent/50 hover:border-accent-foreground/20",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              )}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <SeverityBadge severity={finding.severity} size="sm" />
                      <span className="text-xs text-muted-foreground font-mono">
                        {finding.ruleId}
                      </span>
                      <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-md capitalize">
                        {finding.category}
                      </span>
                      {finding.abuseClassification && (
                        <CostAmplificationBadge
                          costAmplification={finding.abuseClassification.costAmplification}
                        />
                      )}
                    </div>

                    <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                      {finding.title}
                    </h3>

                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                      {finding.description}
                    </p>

                    {finding.evidence.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                        <FileCode className="w-3.5 h-3.5" />
                        <span className="font-mono">
                          {finding.evidence[0].file}:{finding.evidence[0].startLine}
                        </span>
                        {finding.evidence.length > 1 && (
                          <span className="text-muted-foreground/70">
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
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
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
