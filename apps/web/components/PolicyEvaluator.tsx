"use client";

import { useState, useEffect } from "react";
import { useArtifactStore } from "@/lib/store";
import {
  usePolicyStore,
  PROFILE_NAMES,
  type ProfileName,
} from "@/lib/policy-store";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const PROFILE_DESCRIPTIONS: Record<ProfileName, string> = {
  startup: "Fails on critical, warns on high",
  strict: "Fails on high/critical, warns on medium",
  "compliance-lite": "Compliance-focused with count limits",
};

function StatusBadge({ status }: { status: "pass" | "warn" | "fail" }) {
  const config = {
    pass: {
      icon: CheckCircle,
      label: "PASS",
      className: "bg-green-500/10 text-green-500 border-green-500/20",
    },
    warn: {
      icon: AlertTriangle,
      label: "WARN",
      className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    },
    fail: {
      icon: XCircle,
      label: "FAIL",
      className: "bg-red-500/10 text-red-500 border-red-500/20",
    },
  }[status];

  const Icon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-md border font-medium",
        config.className
      )}
    >
      <Icon className="w-4 h-4" />
      {config.label}
    </div>
  );
}

export function PolicyEvaluator() {
  const { selectedArtifact, artifacts } = useArtifactStore();
  const {
    selectedProfile,
    baselineArtifactId,
    lastReport,
    waivers,
    setProfile,
    setBaseline,
    evaluateArtifact,
  } = usePolicyStore();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Get baseline artifact if selected
  const baselineArtifact = artifacts.find((a) => a.id === baselineArtifactId);

  // Re-evaluate when profile or baseline changes
  useEffect(() => {
    if (selectedArtifact) {
      handleEvaluate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedArtifact?.id, selectedProfile, baselineArtifactId, waivers.length]);

  const handleEvaluate = () => {
    if (!selectedArtifact) return;
    setIsEvaluating(true);
    try {
      evaluateArtifact(
        selectedArtifact.artifact,
        baselineArtifact?.artifact
      );
    } finally {
      setIsEvaluating(false);
    }
  };

  if (!selectedArtifact) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">Policy Gate</CardTitle>
          {lastReport && (
            <StatusBadge status={lastReport.status} />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls Row */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Profile Select */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Profile:</span>
            <Select
              value={selectedProfile}
              onValueChange={(v) => setProfile(v as ProfileName)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROFILE_NAMES.map((name) => (
                  <SelectItem key={name} value={name}>
                    <div className="flex flex-col">
                      <span className="font-medium">{name}</span>
                      <span className="text-xs text-muted-foreground">
                        {PROFILE_DESCRIPTIONS[name]}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Baseline Select */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Baseline:</span>
            <Select
              value={baselineArtifactId ?? "none"}
              onValueChange={(v) => setBaseline(v === "none" ? null : v)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="No baseline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No baseline</SelectItem>
                {artifacts
                  .filter((a) => a.id !== selectedArtifact.id)
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Re-evaluate Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleEvaluate}
            disabled={isEvaluating}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", isEvaluating && "animate-spin")} />
            Evaluate
          </Button>

          {/* Expand/Collapse */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="ml-auto"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-1" />
                Less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-1" />
                Details
              </>
            )}
          </Button>
        </div>

        {/* Summary Stats */}
        {lastReport && (
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Active:</span>
              <span className="font-medium">{lastReport.summary.total}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Waived:</span>
              <span className="font-medium">{lastReport.summary.waived}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Ignored:</span>
              <span className="font-medium">{lastReport.summary.ignored}</span>
            </div>
            {lastReport.regression && (
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Net change:</span>
                <span className={cn(
                  "font-medium",
                  lastReport.regression.netChange > 0 ? "text-red-500" :
                  lastReport.regression.netChange < 0 ? "text-green-500" :
                  "text-muted-foreground"
                )}>
                  {lastReport.regression.netChange > 0 ? "+" : ""}
                  {lastReport.regression.netChange}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Expanded Details */}
        {isExpanded && lastReport && (
          <div className="space-y-4 pt-4 border-t">
            {/* Reasons */}
            <div>
              <h4 className="text-sm font-medium mb-2">Reasons</h4>
              <ul className="space-y-1 text-sm">
                {lastReport.reasons.map((reason, i) => (
                  <li key={i} className="flex items-start gap-2">
                    {reason.status === "fail" ? (
                      <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    ) : reason.status === "warn" ? (
                      <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    )}
                    <span>{reason.message}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Thresholds */}
            <div>
              <h4 className="text-sm font-medium mb-2">Thresholds</h4>
              <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                <div>Fail on: {lastReport.thresholds.failOnSeverity}</div>
                <div>Warn on: {lastReport.thresholds.warnOnSeverity}</div>
                <div>Min confidence (fail): {lastReport.thresholds.minConfidenceForFail}</div>
                <div>Min confidence (warn): {lastReport.thresholds.minConfidenceForWarn}</div>
              </div>
            </div>

            {/* Regression Summary */}
            {lastReport.regression && (
              <div>
                <h4 className="text-sm font-medium mb-2">Regression Analysis</h4>
                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <div>New findings: {lastReport.regression.newFindings.length}</div>
                  <div>Resolved: {lastReport.regression.resolvedFindings.length}</div>
                  <div>Severity regressions: {lastReport.regression.severityRegressions.length}</div>
                  <div>Persisting: {lastReport.regression.persistingCount}</div>
                </div>
              </div>
            )}

            {/* Waived Findings */}
            {lastReport.waivedFindings.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Waived Findings</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {lastReport.waivedFindings.map((wf, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-xs px-1.5 py-0.5 bg-muted rounded">
                        {wf.finding.ruleId}
                      </span>
                      <span>{wf.finding.title}</span>
                      {wf.expired && (
                        <span className="text-xs text-red-500">(expired)</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
