"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Upload,
  Info,
  ArrowRight,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { useArtifactStore } from "@/lib/store";
import { usePolicyStore } from "@/lib/policy-store";
import { useWhatIfStore } from "@/lib/whatif-store";
import {
  evaluateArtifact,
  computeExtendedRegression,
  wouldBlockDeploy,
  type ProfileName,
  type PolicyReport,
} from "@/lib/policy";
import {
  evaluateWithWhatIf,
  type WhatIfPolicyReport,
} from "@/lib/whatif-evaluator";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import {
  PolicyResultBanner,
  RegressionSummary,
  CoverageRegressionCard,
  DeployBlockIndicator,
  BaselineSelector,
  ProfileSelector,
} from "@/components/policy";
import { FeatureGate } from "@/components/license";
import { WaiverManager } from "@/components/WaiverManager";
import { WhatIfToggle, WhatIfPanel } from "@/components/whatif";

export default function PolicyPage() {
  const { artifacts, selectedArtifactId } = useArtifactStore();
  const { waivers } = usePolicyStore();
  const { isEnabled: whatIfEnabled, overrides, pathIgnores } = useWhatIfStore();

  // State
  const [baselineId, setBaselineId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileName>("startup");

  // Get artifacts
  const currentArtifact = useMemo(
    () => artifacts.find((a) => a.id === selectedArtifactId),
    [artifacts, selectedArtifactId]
  );

  const baselineArtifact = useMemo(
    () => (baselineId ? artifacts.find((a) => a.id === baselineId) : null),
    [artifacts, baselineId]
  );

  // Auto-select most recent artifact as baseline (excluding current)
  useEffect(() => {
    // Placeholder for potential auto-baseline feature
  }, [artifacts, currentArtifact, baselineId]);

  // Compute policy report (re-evaluates when waivers change)
  const policyReport = useMemo<PolicyReport | null>(() => {
    if (!currentArtifact) return null;

    return evaluateArtifact(
      currentArtifact.artifact,
      baselineArtifact?.artifact ?? null,
      profile,
      waivers
    );
  }, [currentArtifact, baselineArtifact, profile, waivers]);

  // Compute What-If report when mode is enabled
  const whatIfReport = useMemo<WhatIfPolicyReport | null>(() => {
    if (!currentArtifact || !whatIfEnabled) return null;

    return evaluateWithWhatIf({
      artifact: currentArtifact.artifact,
      baseline: baselineArtifact?.artifact,
      profile,
      waivers,
      whatIfOverrides: overrides,
      whatIfPathIgnores: pathIgnores,
    });
  }, [currentArtifact, baselineArtifact, profile, waivers, whatIfEnabled, overrides, pathIgnores]);

  // Use What-If report when enabled, otherwise regular report
  const activeReport = whatIfEnabled && whatIfReport ? whatIfReport : policyReport;

  // Compute extended regression info
  const extendedRegression = useMemo(() => {
    if (!currentArtifact) return null;

    return computeExtendedRegression(
      currentArtifact.artifact,
      baselineArtifact?.artifact ?? null
    );
  }, [currentArtifact, baselineArtifact]);

  // No artifact loaded
  if (!currentArtifact) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <ShieldCheck className="w-8 h-8" />
            Policy Engine
          </h1>
          <p className="text-muted-foreground mt-1">
            Evaluate artifacts against security policies for CI/CD integration
          </p>
        </div>

        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<Upload className="w-8 h-8 text-muted-foreground" />}
              title="No artifact loaded"
              description="Import a scan artifact from the Dashboard to evaluate against policies."
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
    <FeatureGate feature="policy_customization" fullPage>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <ShieldCheck className="w-8 h-8" />
              Policy Engine
              <span className="px-2 py-1 text-xs font-medium bg-amber-500/10 text-amber-500 rounded-md border border-amber-500/20">
                Pro
              </span>
            </h1>
            <p className="text-muted-foreground mt-1">
              Evaluate your scan against security policies and detect regressions
            </p>
          </div>
          <WhatIfToggle />
        </div>

        {/* What-If Panel */}
        {whatIfEnabled && currentArtifact && (
          <WhatIfPanel
            artifact={currentArtifact.artifact}
            baseline={baselineArtifact?.artifact}
            profile={profile}
            waivers={waivers}
          />
        )}

        {/* Configuration Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <BaselineSelector
              artifacts={artifacts}
              currentArtifactId={selectedArtifactId}
              baselineArtifactId={baselineId}
              onBaselineChange={setBaselineId}
            />
          </div>
          <div>
            <Card className="h-full">
              <CardContent className="p-4">
                <ProfileSelector value={profile} onChange={setProfile} />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Waivers Section */}
        <WaiverManager />

        {/* Policy Result Banner */}
        {activeReport && !whatIfEnabled && <PolicyResultBanner report={activeReport} />}

        {/* Deploy Block Indicator */}
        {activeReport && !whatIfEnabled && (
          <DeployBlockIndicator
            wouldBlock={wouldBlockDeploy(activeReport)}
            status={activeReport.status}
          />
        )}

        {/* Regression Analysis */}
        {extendedRegression && extendedRegression.regression && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <h2 className="text-xl font-semibold">Regression Analysis</h2>
            </div>
            <RegressionSummary regression={extendedRegression.regression} />
          </motion.div>
        )}

        {/* Coverage Regressions */}
        {extendedRegression && extendedRegression.coverageRegressions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <CoverageRegressionCard regressions={extendedRegression.coverageRegressions} />
          </motion.div>
        )}

        {/* No Baseline Info */}
        {!baselineArtifact && (
          <Card className="border-dashed">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-muted">
                  <Info className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">No Baseline Selected</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Select a baseline artifact above to see regression analysis, including new findings,
                    resolved issues, and coverage changes.
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <ArrowRight className="w-4 h-4" />
                    <span>Policy evaluation still runs without a baseline</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Stats */}
        {activeReport && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="text-xl font-semibold mb-4">
              Finding Summary
              {whatIfEnabled && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  (simulated)
                </span>
              )}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {(["critical", "high", "medium", "low", "info"] as const).map((severity) => {
                const count = activeReport.summary.bySeverity[severity];
                const colorConfig = {
                  critical: { text: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30" },
                  high: { text: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/30" },
                  medium: { text: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/30" },
                  low: { text: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/30" },
                  info: { text: "text-slate-500", bg: "bg-slate-500/10", border: "border-slate-500/30" },
                }[severity];

                return (
                  <Card
                    key={severity}
                    className={count > 0 ? `${colorConfig.border} ${colorConfig.bg}` : ""}
                  >
                    <CardContent className="p-4 text-center">
                      <p className={`text-2xl font-bold tabular-nums ${count > 0 ? colorConfig.text : "text-muted-foreground"}`}>
                        {count}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">{severity}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </FeatureGate>
  );
}
