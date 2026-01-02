"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  AlertTriangle,
  ArrowRight,
  Upload,
  CheckCircle2,
  Terminal,
  Zap,
  Lock,
  BookOpen,
  Loader2,
  AlertCircle,
  ShieldCheck,
  FileCheck,
  Route,
  Activity,
  Info,
} from "lucide-react";
import { useArtifactStore } from "@/lib/store";
import { validateArtifact } from "@vibecheck/schema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AbuseRiskCard } from "@/components/AbuseRiskCard";

export default function DashboardPage() {
  const { artifacts, selectedArtifactId, importArtifact } = useArtifactStore();
  const selectedArtifact = useMemo(
    () => artifacts.find((a) => a.id === selectedArtifactId),
    [artifacts, selectedArtifactId]
  );

  const findings = useMemo(
    () => selectedArtifact?.artifact.findings ?? [],
    [selectedArtifact]
  );

  const severityCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    findings.forEach((f) => {
      const sev = f.severity.toLowerCase() as keyof typeof counts;
      if (sev in counts) counts[sev]++;
    });
    return counts;
  }, [findings]);

  // Upload state
  const [uploadState, setUploadState] = useState<"idle" | "dragging" | "processing" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const processFile = useCallback(
    async (file: File) => {
      setUploadState("processing");
      setErrorMessage("");

      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const artifact = validateArtifact(json);
        await importArtifact(artifact, file.name.replace(/\.json$/, ""));
        setUploadState("success");
        setTimeout(() => setUploadState("idle"), 2000);
      } catch (err) {
        setUploadState("error");
        setErrorMessage(err instanceof Error ? err.message : "Failed to parse artifact");
        setTimeout(() => setUploadState("idle"), 3000);
      }
    },
    [importArtifact]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setUploadState("idle");
      const file = e.dataTransfer.files[0];
      if (file?.type === "application/json" || file?.name.endsWith(".json")) {
        processFile(file);
      } else {
        setUploadState("error");
        setErrorMessage("Please drop a JSON file");
        setTimeout(() => setUploadState("idle"), 3000);
      }
    },
    [processFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = "";
    },
    [processFile]
  );

  const riskScore = useMemo(() => {
    if (findings.length === 0) return null;
    const score = Math.max(0, 100 - (severityCounts.critical * 25 + severityCounts.high * 10 + severityCounts.medium * 3 + severityCounts.low * 1));
    return Math.round(score);
  }, [findings.length, severityCounts]);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Import and analyze your security scan artifacts
        </p>
      </div>

      {/* Upload Zone */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <motion.div
            className={cn(
              "relative p-8 sm:p-12 transition-all duration-200 cursor-pointer border-2 border-dashed rounded-lg m-4",
              uploadState === "dragging" && "border-primary bg-primary/5",
              uploadState === "error" && "border-destructive bg-destructive/5",
              uploadState === "success" && "border-green-500 bg-green-500/5",
              uploadState === "idle" && "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50"
            )}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setUploadState("dragging"); }}
            onDragLeave={(e) => { e.preventDefault(); setUploadState("idle"); }}
          >
            <div className="flex flex-col items-center gap-4 text-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={uploadState}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center",
                    uploadState === "success" ? "bg-green-500/10" :
                    uploadState === "error" ? "bg-destructive/10" :
                    "bg-muted"
                  )}
                >
                  {uploadState === "processing" ? (
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  ) : uploadState === "success" ? (
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                  ) : uploadState === "error" ? (
                    <AlertCircle className="w-8 h-8 text-destructive" />
                  ) : (
                    <Upload className="w-8 h-8 text-muted-foreground" />
                  )}
                </motion.div>
              </AnimatePresence>

              <div>
                <p className={cn(
                  "text-lg font-medium",
                  uploadState === "error" && "text-destructive",
                  uploadState === "success" && "text-green-500"
                )}>
                  {uploadState === "dragging" ? "Drop to import" :
                   uploadState === "processing" ? "Analyzing artifact..." :
                   uploadState === "success" ? "Import successful!" :
                   uploadState === "error" ? errorMessage :
                   "Drop your scan artifact here"}
                </p>
                {uploadState === "idle" && (
                  <p className="text-sm text-muted-foreground mt-1">
                    or{" "}
                    <label className="text-primary hover:underline cursor-pointer font-medium">
                      browse files
                      <input
                        type="file"
                        accept=".json"
                        className="sr-only"
                        onChange={handleFileSelect}
                      />
                    </label>
                  </p>
                )}
              </div>

              {uploadState === "idle" && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted font-mono text-sm">
                  <span className="text-primary">$</span>
                  <span className="text-muted-foreground">vibecheck scan -o scan.json</span>
                </div>
              )}
            </div>
          </motion.div>
        </CardContent>
      </Card>

      {/* Results Section */}
      {selectedArtifact && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Summary Header */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    riskScore !== null && riskScore >= 80 ? "bg-green-500/10" :
                    riskScore !== null && riskScore >= 50 ? "bg-yellow-500/10" :
                    "bg-destructive/10"
                  )}>
                    <Shield className={cn(
                      "w-6 h-6",
                      riskScore !== null && riskScore >= 80 ? "text-green-500" :
                      riskScore !== null && riskScore >= 50 ? "text-yellow-500" :
                      "text-destructive"
                    )} />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">{selectedArtifact.artifact.repo?.name ?? "Scan Results"}</h2>
                    <p className="text-sm text-muted-foreground">
                      {new Date(selectedArtifact.artifact.generatedAt).toLocaleDateString()} • {findings.length} findings
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {riskScore !== null && (
                    <div className="text-right mr-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Security Score</p>
                      <p className={cn(
                        "text-2xl font-bold tabular-nums",
                        riskScore >= 80 ? "text-green-500" :
                        riskScore >= 50 ? "text-yellow-500" :
                        "text-destructive"
                      )}>{riskScore}/100</p>
                    </div>
                  )}
                  <Link href="/findings">
                    <Button className="gap-2">
                      View All Findings
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Score Explanation */}
          {riskScore !== null && (
            <ScoreExplanation score={riskScore} severityCounts={severityCounts} />
          )}

          {/* Severity Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <SeverityCard severity="critical" count={severityCounts.critical} />
            <SeverityCard severity="high" count={severityCounts.high} />
            <SeverityCard severity="medium" count={severityCounts.medium} />
            <SeverityCard severity="low" count={severityCounts.low} />
            <SeverityCard severity="info" count={severityCounts.info} />
          </div>

          {/* Abuse Risk Card */}
          <AbuseRiskCard findings={findings} />

          {/* Coverage Cards */}
          {selectedArtifact.artifact.metrics && (
            <CoverageCards metrics={selectedArtifact.artifact.metrics} />
          )}

          {/* Quick Stats */}
          <div className="grid sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <Terminal className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Scanner Version</p>
                    <p className="text-sm font-medium">{selectedArtifact.artifact.tool?.version ?? "Unknown"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <Zap className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Artifact Version</p>
                    <p className="text-sm font-medium">{selectedArtifact.artifact.artifactVersion}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <Lock className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Analysis Type</p>
                    <p className="text-sm font-medium">Static Analysis</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}

      {/* Empty State */}
      {!selectedArtifact && artifacts.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="grid sm:grid-cols-3 gap-4">
            <FeatureCard
              icon={Terminal}
              title="Run a Scan"
              description="Use the CLI to scan your codebase for security issues"
              command="npx vibecheck scan"
            />
            <FeatureCard
              icon={BookOpen}
              title="View Documentation"
              description="Learn about security rules and best practices"
              href="/docs"
            />
            <FeatureCard
              icon={Shield}
              title="Explore Rules"
              description="See all 26 security rules across 10 categories"
              href="/docs/rules"
            />
          </div>
        </motion.div>
      )}

      {/* Quick Links */}
      <div className="grid sm:grid-cols-4 gap-4">
        <QuickLink href="/docs" icon={BookOpen} label="Installation" />
        <QuickLink href="/docs/security-philosophy" icon={Shield} label="Philosophy" />
        <QuickLink href="/docs/policy-engine" icon={Activity} label="Policy Engine" />
        <QuickLink href="/docs/ci-cd" icon={Terminal} label="CI/CD Integration" />
      </div>
    </div>
  );
}

function SeverityCard({ severity, count }: { severity: string; count: number }) {
  const config = {
    critical: { color: "text-red-500 dark:text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
    high: { color: "text-orange-500 dark:text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30" },
    medium: { color: "text-yellow-500 dark:text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30" },
    low: { color: "text-blue-500 dark:text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
    info: { color: "text-slate-500 dark:text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/30" },
  }[severity] ?? { color: "text-muted-foreground", bg: "bg-muted", border: "border-border" };

  return (
    <Card className={cn(count > 0 && config.border, count > 0 && config.bg)}>
      <CardContent className="p-4 text-center">
        <p className="text-sm text-muted-foreground capitalize mb-1">{severity}</p>
        <p className={cn("text-3xl font-bold tabular-nums", count > 0 ? config.color : "text-muted-foreground")}>{count}</p>
        {count > 0 && severity === "critical" && (
          <AlertTriangle className="w-4 h-4 text-red-500 mx-auto mt-2" />
        )}
      </CardContent>
    </Card>
  );
}

function FeatureCard({ icon: Icon, title, description, command, href }: {
  icon: typeof Terminal;
  title: string;
  description: string;
  command?: string;
  href?: string;
}) {
  const content = (
    <Card className="h-full hover:bg-muted/50 transition-colors">
      <CardContent className="p-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        {command && (
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-muted font-mono text-xs">
            <span className="text-primary">$</span>
            <span className="text-muted-foreground">{command}</span>
          </div>
        )}
        {href && (
          <span className="inline-flex items-center gap-1 text-sm text-primary font-medium">
            Learn more <ArrowRight className="w-3 h-3" />
          </span>
        )}
      </CardContent>
    </Card>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: typeof Terminal; label: string }) {
  return (
    <Link href={href}>
      <Card className="hover:bg-muted/50 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Icon className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium">{label}</span>
            <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

interface CoverageMetrics {
  authCoverage?: { totalStateChanging: number; protectedCount: number; unprotectedCount: number };
  validationCoverage?: { totalStateChanging: number; validatedCount: number };
  middlewareCoverage?: { totalApiRoutes: number; coveredApiRoutes: number };
}

function CoverageCards({ metrics }: { metrics: CoverageMetrics }) {
  const authPct = metrics.authCoverage && metrics.authCoverage.totalStateChanging > 0
    ? Math.round((metrics.authCoverage.protectedCount / metrics.authCoverage.totalStateChanging) * 100)
    : null;

  const valPct = metrics.validationCoverage && metrics.validationCoverage.totalStateChanging > 0
    ? Math.round((metrics.validationCoverage.validatedCount / metrics.validationCoverage.totalStateChanging) * 100)
    : null;

  const mwPct = metrics.middlewareCoverage && metrics.middlewareCoverage.totalApiRoutes > 0
    ? Math.round((metrics.middlewareCoverage.coveredApiRoutes / metrics.middlewareCoverage.totalApiRoutes) * 100)
    : null;

  if (authPct === null && valPct === null && mwPct === null) return null;

  return (
    <div className="grid sm:grid-cols-3 gap-4">
      {authPct !== null && (
        <CoverageCard
          icon={ShieldCheck}
          label="Auth Coverage"
          percentage={authPct}
          detail={`${metrics.authCoverage!.protectedCount}/${metrics.authCoverage!.totalStateChanging} routes`}
        />
      )}
      {valPct !== null && (
        <CoverageCard
          icon={FileCheck}
          label="Validation Coverage"
          percentage={valPct}
          detail={`${metrics.validationCoverage!.validatedCount}/${metrics.validationCoverage!.totalStateChanging} routes`}
        />
      )}
      {mwPct !== null && (
        <CoverageCard
          icon={Route}
          label="Middleware Coverage"
          percentage={mwPct}
          detail={`${metrics.middlewareCoverage!.coveredApiRoutes}/${metrics.middlewareCoverage!.totalApiRoutes} routes`}
        />
      )}
    </div>
  );
}

function CoverageCard({ icon: Icon, label, percentage, detail }: {
  icon: typeof Shield;
  label: string;
  percentage: number;
  detail: string;
}) {
  const color = percentage >= 80
    ? "text-green-500 dark:text-green-400"
    : percentage >= 50
    ? "text-yellow-500 dark:text-yellow-400"
    : "text-red-500 dark:text-red-400";

  const bgColor = percentage >= 80
    ? "bg-green-500/10 border-green-500/30"
    : percentage >= 50
    ? "bg-yellow-500/10 border-yellow-500/30"
    : "bg-red-500/10 border-red-500/30";

  return (
    <Card className={bgColor}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center bg-background/50", color)}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn("text-2xl font-bold tabular-nums", color)}>{percentage}%</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{detail}</p>
      </CardContent>
    </Card>
  );
}

function ScoreExplanation({ score, severityCounts }: {
  score: number;
  severityCounts: { critical: number; high: number; medium: number; low: number; info: number };
}) {
  const getScoreLabel = (s: number) => {
    if (s >= 90) return { label: "Excellent", description: "Minimal security concerns. Ready for production." };
    if (s >= 70) return { label: "Good", description: "Some issues to address, but overall solid security posture." };
    if (s >= 50) return { label: "Fair", description: "Notable security gaps that should be addressed." };
    if (s >= 25) return { label: "Poor", description: "Significant vulnerabilities requiring attention." };
    return { label: "Critical", description: "Urgent security issues. Address critical findings immediately." };
  };

  const { label, description } = getScoreLabel(score);

  const deductions = {
    critical: severityCounts.critical * 25,
    high: severityCounts.high * 10,
    medium: severityCounts.medium * 3,
    low: severityCounts.low * 1,
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Info className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "font-semibold",
                  score >= 70 ? "text-green-500" :
                  score >= 50 ? "text-yellow-500" :
                  "text-destructive"
                )}>{label}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">{description}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground font-medium">Score Breakdown:</span>
                <span className="text-muted-foreground">100</span>
                {deductions.critical > 0 && (
                  <span className="text-red-500">- {deductions.critical} <span className="text-muted-foreground">({severityCounts.critical} critical × 25)</span></span>
                )}
                {deductions.high > 0 && (
                  <span className="text-orange-500">- {deductions.high} <span className="text-muted-foreground">({severityCounts.high} high × 10)</span></span>
                )}
                {deductions.medium > 0 && (
                  <span className="text-yellow-500">- {deductions.medium} <span className="text-muted-foreground">({severityCounts.medium} medium × 3)</span></span>
                )}
                {deductions.low > 0 && (
                  <span className="text-blue-500">- {deductions.low} <span className="text-muted-foreground">({severityCounts.low} low × 1)</span></span>
                )}
                <span className="text-muted-foreground">=</span>
                <span className={cn(
                  "font-semibold",
                  score >= 70 ? "text-green-500" :
                  score >= 50 ? "text-yellow-500" :
                  "text-destructive"
                )}>{score}</span>
              </div>
            </div>

            <div className="flex items-center gap-1 pt-1">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden flex">
                <div className="h-full bg-red-500" style={{ width: "10%" }} title="0-9: Critical" />
                <div className="h-full bg-orange-500" style={{ width: "15%" }} title="10-24: Poor" />
                <div className="h-full bg-yellow-500" style={{ width: "25%" }} title="25-49: Fair" />
                <div className="h-full bg-lime-500" style={{ width: "20%" }} title="50-69: Good" />
                <div className="h-full bg-green-500" style={{ width: "30%" }} title="70-100: Excellent" />
              </div>
              <div
                className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[8px] border-l-transparent border-r-transparent border-b-foreground absolute"
                style={{
                  marginLeft: `${Math.min(score, 100)}%`,
                  transform: 'translateX(-50%)',
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0 Critical</span>
              <span>25 Poor</span>
              <span>50 Fair</span>
              <span>70 Good</span>
              <span>100 Excellent</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
