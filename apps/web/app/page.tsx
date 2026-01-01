"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  FileCode,
  ArrowRight,
  GitBranch,
  Upload,
  ShieldCheck,
} from "lucide-react";
import { useArtifactStore } from "@/lib/store";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadDropzone } from "@/components/UploadDropzone";
import { SeverityBadge } from "@/components/SeverityBadge";
import { RiskPosture } from "@/components/RiskPosture";
import { CopyReport } from "@/components/CopyReport";
import { EmptyState } from "@/components/EmptyState";
import type { Severity, Finding, Category } from "@vibecheck/schema";

const severityIcons: Record<Severity, React.ElementType> = {
  critical: AlertTriangle,
  high: AlertTriangle,
  medium: AlertCircle,
  low: Info,
  info: Info,
};

const severityColors: Record<Severity, string> = {
  critical: "text-severity-critical",
  high: "text-severity-high",
  medium: "text-severity-medium",
  low: "text-severity-low",
  info: "text-severity-info",
};

const severityBgColors: Record<Severity, string> = {
  critical: "bg-severity-critical/10",
  high: "bg-severity-high/10",
  medium: "bg-severity-medium/10",
  low: "bg-severity-low/10",
  info: "bg-severity-info/10",
};

function SeverityCard({
  severity,
  count,
  delay,
}: {
  severity: Severity;
  count: number;
  delay: number;
}) {
  const Icon = severityIcons[severity];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <Card className={count > 0 ? severityBgColors[severity] : ""}>
        <CardContent className="pt-6 pb-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {severity}
              </p>
              <p className="text-3xl font-bold mt-1 tabular-nums">{count}</p>
            </div>
            <div className={`p-2 rounded-lg ${severityBgColors[severity]}`}>
              <Icon className={`w-6 h-6 ${severityColors[severity]}`} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function DashboardPage() {
  const { artifacts, selectedArtifactId } = useArtifactStore();
  const selectedArtifact = artifacts.find((a) => a.id === selectedArtifactId);
  const artifact = selectedArtifact?.artifact;

  const topFindings = useMemo(() => {
    if (!artifact) return [];
    return [...artifact.findings]
      .sort((a: Finding, b: Finding) => {
        const order: Record<Severity, number> = {
          critical: 4,
          high: 3,
          medium: 2,
          low: 1,
          info: 0,
        };
        return order[b.severity] - order[a.severity];
      })
      .slice(0, 5);
  }, [artifact]);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Security scan overview and insights
          </p>
        </div>
        {artifact && <CopyReport artifact={artifact} />}
      </div>

      {/* Main Content */}
      {artifact ? (
        <>
          {/* Metadata Bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm"
          >
            {artifact.repo && (
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-muted-foreground" />
                <span className="font-semibold">{artifact.repo.name}</span>
                {artifact.repo.git?.branch && (
                  <span className="text-muted-foreground">
                    ({artifact.repo.git.branch})
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              {formatDate(artifact.generatedAt)}
            </div>
            {artifact.metrics && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileCode className="w-4 h-4" />
                {artifact.metrics.filesScanned.toLocaleString()} files
              </div>
            )}
          </motion.div>

          {/* Severity Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {(["critical", "high", "medium", "low", "info"] as Severity[]).map(
              (severity, i) => (
                <SeverityCard
                  key={severity}
                  severity={severity}
                  count={artifact.summary.bySeverity[severity]}
                  delay={0.1 + i * 0.05}
                />
              )
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Risk Posture */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.35 }}
            >
              <RiskPosture severityCounts={artifact.summary.bySeverity} />
            </motion.div>

            {/* Upload Another */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
            >
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">
                    Import Another Artifact
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <UploadDropzone compact />
                </CardContent>
              </Card>
            </motion.div>

            {/* Top Findings */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.45 }}
            >
              <Card className="h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base font-semibold">
                    Top Findings
                  </CardTitle>
                  <Link href="/findings" tabIndex={-1}>
                    <Button variant="ghost" size="sm" className="text-xs">
                      View all
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {topFindings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <ShieldCheck className="w-10 h-10 text-success mb-3" />
                      <p className="text-sm font-medium">No findings</p>
                      <p className="text-xs text-muted-foreground">
                        This scan produced no security findings
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {topFindings.map((finding) => (
                        <Link
                          key={finding.id}
                          href={`/findings/${encodeURIComponent(finding.id)}`}
                          className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                        >
                          <div className="flex items-start gap-3 p-2.5 -mx-2 rounded-lg hover:bg-muted/50 transition-colors">
                            <SeverityBadge
                              severity={finding.severity}
                              size="sm"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                {finding.title}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                {finding.ruleId}
                              </p>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Categories */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.5 }}
            >
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">
                    By Category
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(
                      Object.entries(artifact.summary.byCategory) as [
                        Category,
                        number
                      ][]
                    )
                      .filter(([, count]) => count > 0)
                      .sort(([, a], [, b]) => b - a)
                      .map(([category, count]) => (
                        <div
                          key={category}
                          className="flex items-center justify-between py-1.5"
                        >
                          <span className="text-sm capitalize">{category}</span>
                          <span className="text-sm font-semibold tabular-nums">
                            {count}
                          </span>
                        </div>
                      ))}
                    {Object.values(artifact.summary.byCategory).every(
                      (c) => c === 0
                    ) && (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        No findings by category
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </>
      ) : (
        /* Empty State */
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<Upload className="w-8 h-8 text-muted-foreground" />}
              title="No artifact loaded"
              description="Import a VibeCheck scan artifact to view security findings and insights."
              action={
                <div className="w-full max-w-md">
                  <UploadDropzone />
                </div>
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
