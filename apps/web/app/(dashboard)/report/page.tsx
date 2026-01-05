"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FileText,
  Upload,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Shield,
  Clock,
  FileCode,
  Eye,
  Loader2,
} from "lucide-react";
import { useArtifactStore } from "@/lib/store";
import { usePolicyStore } from "@/lib/policy-store";
import { applyWaivers } from "@vibecheck/policy";
import { evaluateArtifact, type ProfileName } from "@/lib/policy";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { FeatureGate } from "@/components/license";
import { computeIntegrityHash, type ReportData } from "@/components/report";

// Dynamic imports for PDF components to avoid SSR issues
const PDFDownloadButton = dynamic(
  () => import("@/components/report/PDFDownloadButton").then((mod) => mod.PDFDownloadButton),
  {
    ssr: false,
    loading: () => (
      <Button disabled className="gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading...
      </Button>
    ),
  }
);

const PDFPreview = dynamic(
  () => import("@/components/report/PDFPreview").then((mod) => mod.PDFPreview),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[600px] border rounded-lg flex items-center justify-center bg-muted/50">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

export default function ReportPage() {
  const { artifacts, selectedArtifactId } = useArtifactStore();
  const { waivers, selectedProfile } = usePolicyStore();
  const [showPreview, setShowPreview] = useState(false);
  const [integrityHash, setIntegrityHash] = useState<string | undefined>();

  const selectedArtifact = useMemo(
    () => artifacts.find((a) => a.id === selectedArtifactId),
    [artifacts, selectedArtifactId]
  );

  const allFindings = useMemo(
    () => selectedArtifact?.artifact.findings ?? [],
    [selectedArtifact]
  );

  const { activeFindings, waivedFindings } = useMemo(
    () => applyWaivers(allFindings, waivers),
    [allFindings, waivers]
  );

  const policyReport = useMemo(() => {
    if (!selectedArtifact) return null;
    return evaluateArtifact(
      selectedArtifact.artifact,
      null,
      selectedProfile as ProfileName,
      waivers
    );
  }, [selectedArtifact, selectedProfile, waivers]);

  const reportData: ReportData | null = useMemo(() => {
    if (!selectedArtifact) return null;
    return {
      artifact: selectedArtifact.artifact,
      policyReport,
      waivers,
      waivedFindings,
      activeFindings,
      generatedAt: new Date().toISOString(),
      profile: selectedProfile,
      integrityHash,
    };
  }, [selectedArtifact, policyReport, waivers, waivedFindings, activeFindings, selectedProfile, integrityHash]);

  // Compute integrity hash when report data changes
  useEffect(() => {
    if (!selectedArtifact) {
      setIntegrityHash(undefined);
      return;
    }

    const baseData: ReportData = {
      artifact: selectedArtifact.artifact,
      policyReport,
      waivers,
      waivedFindings,
      activeFindings,
      generatedAt: new Date().toISOString(),
      profile: selectedProfile,
    };

    computeIntegrityHash(baseData).then(setIntegrityHash);
  }, [selectedArtifact, policyReport, waivers, waivedFindings, activeFindings, selectedProfile]);

  const severityCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    activeFindings.forEach((f) => {
      const sev = f.severity.toLowerCase() as keyof typeof counts;
      if (sev in counts) counts[sev]++;
    });
    return counts;
  }, [activeFindings]);

  const securityScore = useMemo(() => {
    return Math.max(
      0,
      100 -
        severityCounts.critical * 25 -
        severityCounts.high * 10 -
        severityCounts.medium * 3 -
        severityCounts.low * 1
    );
  }, [severityCounts]);

  const getFileName = useCallback(() => {
    const repoName = selectedArtifact?.artifact.repo?.name ?? "scan";
    const date = new Date().toISOString().split("T")[0];
    return `vibecheck-report-${repoName}-${date}.pdf`;
  }, [selectedArtifact]);

  // No artifact loaded
  if (!selectedArtifact) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security Report</h1>
          <p className="text-muted-foreground mt-1">
            Generate an auditable PDF report of your security scan
          </p>
        </div>
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<Upload className="w-8 h-8 text-muted-foreground" />}
              title="No artifact loaded"
              description="Import a scan artifact from the Dashboard to generate a report."
              action={
                <Link href="/">
                  <Button>Go to Dashboard</Button>
                </Link>
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <FeatureGate feature="signed_export" fullPage>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <FileText className="w-8 h-8" />
              Security Report
              <span className="px-2 py-1 text-xs font-medium bg-amber-500/10 text-amber-500 rounded-md border border-amber-500/20">
                Pro
              </span>
            </h1>
            <p className="text-muted-foreground mt-1">
              Generate an auditable PDF report of your security scan results
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
              className="gap-2"
            >
              <Eye className="w-4 h-4" />
              {showPreview ? "Hide Preview" : "Show Preview"}
            </Button>

            {reportData && (
              <PDFDownloadButton data={reportData} fileName={getFileName()} />
            )}
          </div>
        </div>

      {/* PDF Preview */}
      {showPreview && reportData && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">PDF Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <PDFPreview data={reportData} />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Report Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Report Contents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overview Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              icon={Shield}
              label="Security Score"
              value={`${securityScore}/100`}
              color={
                securityScore >= 80
                  ? "text-green-500"
                  : securityScore >= 50
                  ? "text-yellow-500"
                  : "text-red-500"
              }
            />
            <StatCard
              icon={
                policyReport?.status === "pass"
                  ? CheckCircle
                  : policyReport?.status === "warn"
                  ? AlertTriangle
                  : XCircle
              }
              label="Policy Status"
              value={policyReport?.status.toUpperCase() ?? "N/A"}
              color={
                policyReport?.status === "pass"
                  ? "text-green-500"
                  : policyReport?.status === "warn"
                  ? "text-yellow-500"
                  : "text-red-500"
              }
            />
            <StatCard
              icon={FileCode}
              label="Active Findings"
              value={String(activeFindings.length)}
              color={activeFindings.length === 0 ? "text-green-500" : "text-foreground"}
            />
            <StatCard
              icon={Shield}
              label="Waived"
              value={String(waivedFindings.length)}
              color="text-emerald-500"
            />
          </div>

          {/* Sections Preview */}
          <div>
            <h3 className="text-sm font-medium mb-3">Report Sections</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <SectionPreview
                title="Cover Page"
                description="Report title, security score, scan metadata"
                icon={FileText}
              />
              <SectionPreview
                title="Executive Summary"
                description="Policy status, severity breakdown, coverage metrics"
                icon={Shield}
              />
              <SectionPreview
                title={`Waivers (${waivers.length})`}
                description="Applied waivers with reasons and timestamps"
                icon={Shield}
                muted={waivers.length === 0}
              />
              <SectionPreview
                title={`Findings (${activeFindings.length})`}
                description="Detailed findings with evidence, proof traces, remediation"
                icon={AlertTriangle}
                muted={activeFindings.length === 0}
              />
              <SectionPreview
                title="Appendix"
                description="Artifact metadata, policy configuration, statistics"
                icon={Clock}
              />
            </div>
          </div>

          {/* Findings Preview */}
          {activeFindings.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-3">
                Findings Included ({activeFindings.length})
              </h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {activeFindings.map((finding) => (
                  <div
                    key={finding.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border"
                  >
                    <span
                      className={cn(
                        "px-2 py-0.5 text-xs font-medium rounded",
                        finding.severity === "critical" && "bg-red-500/10 text-red-500",
                        finding.severity === "high" && "bg-orange-500/10 text-orange-500",
                        finding.severity === "medium" && "bg-yellow-500/10 text-yellow-500",
                        finding.severity === "low" && "bg-blue-500/10 text-blue-500",
                        finding.severity === "info" && "bg-slate-500/10 text-slate-500"
                      )}
                    >
                      {finding.severity.toUpperCase()}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">
                      {finding.ruleId}
                    </span>
                    <span className="text-sm truncate flex-1">{finding.title}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {finding.fingerprint.slice(0, 8)}...
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Artifact Info */}
          <div className="pt-4 border-t">
            <h3 className="text-sm font-medium mb-3">Artifact Information</h3>
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              <div className="flex gap-2">
                <span className="text-muted-foreground">Repository:</span>
                <span>{selectedArtifact.artifact.repo?.name ?? "Unknown"}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground">Scan Date:</span>
                <span>
                  {new Date(selectedArtifact.artifact.generatedAt).toLocaleString()}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground">Scanner Version:</span>
                <span>{selectedArtifact.artifact.tool?.version ?? "Unknown"}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground">Policy Profile:</span>
                <span className="capitalize">{selectedProfile}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </FeatureGate>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Shield;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="p-4 rounded-lg bg-muted/50 border">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className={cn("text-xl font-bold", color)}>{value}</span>
    </div>
  );
}

function SectionPreview({
  title,
  description,
  icon: Icon,
  muted = false,
}: {
  title: string;
  description: string;
  icon: typeof FileText;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border",
        muted ? "bg-muted/30 opacity-60" : "bg-muted/50"
      )}
    >
      <div className="p-1.5 rounded-md bg-primary/10">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
