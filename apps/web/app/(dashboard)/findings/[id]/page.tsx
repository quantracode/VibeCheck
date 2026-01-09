"use client";

import { useMemo, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  FileCode,
  ExternalLink,
  Lightbulb,
  Shield,
  Fingerprint,
  Zap,
  AlertTriangle,
  ShieldOff,
  Clock,
  FileQuestion,
  Lock,
} from "lucide-react";
import { useArtifactStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeverityBadge } from "@/components/SeverityBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { EvidenceCard } from "@/components/EvidenceCard";
import { ProofTraceTimeline } from "@/components/ProofTraceTimeline";
import { AbuseRiskBadge, AbuseCategoryLabel } from "@/components/AbuseRiskBadge";
import {
  PlainEnglishCard,
  SeverityContextCard,
  CodeComparisonCard,
  FixStepsWizard,
  CopyToAIButton,
  DetailViewToggle,
  ViewModeProvider,
  ViewModeContent,
  SmartWaiverDialog,
  AIChatDialog,
} from "@/components/findings";
import { cn } from "@/lib/utils";
import type { Finding, EvidenceItem, AbuseClassification } from "@vibecheck/schema";

function ClaimSection({ claim }: { claim: NonNullable<Finding["claim"]> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Security Claim
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Claim Type
            </p>
            <p className="font-mono text-sm">{claim.type}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Source
            </p>
            <p className="capitalize">{claim.source}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Scope
            </p>
            <p className="capitalize">{claim.scope}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Strength
            </p>
            <p className="capitalize">{claim.strength}</p>
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Evidence
          </p>
          <p className="text-sm bg-muted/50 rounded p-3 font-mono">
            &quot;{claim.textEvidence}&quot;
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Location
          </p>
          <p className="text-sm font-mono">
            {claim.location.file}:{claim.location.startLine}-
            {claim.location.endLine}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function RemediationSection({
  remediation,
}: {
  remediation: Finding["remediation"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Lightbulb className="w-5 h-5" />
          Remediation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
            Recommended Fix
          </p>
          <p className="text-sm">{remediation.recommendedFix}</p>
        </div>

        {remediation.patch && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              Suggested Patch
            </p>
            <pre className="text-xs bg-muted/50 rounded p-4 overflow-x-auto">
              <code>{remediation.patch}</code>
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AbuseClassificationSection({ classification }: { classification: AbuseClassification }) {
  const enforcementIcons: Record<string, typeof Lock> = {
    auth: Lock,
    rate_limit: Clock,
    request_size_limit: FileQuestion,
    timeout: Clock,
    input_validation: ShieldOff,
  };

  const enforcementLabels: Record<string, string> = {
    auth: "Authentication",
    rate_limit: "Rate Limiting",
    request_size_limit: "Request Size Limit",
    timeout: "Timeout",
    input_validation: "Input Validation",
  };

  return (
    <Card className="border-orange-500/30 bg-orange-500/5">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="w-5 h-5 text-orange-400" />
          Compute Abuse Classification
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Risk and Category */}
        <div className="flex flex-wrap items-center gap-3">
          <AbuseRiskBadge
            risk={classification.risk}
            costAmplification={classification.costAmplification}
            size="lg"
          />
          <AbuseCategoryLabel category={classification.category} />
        </div>

        {/* Cost Amplification Warning */}
        {classification.costAmplification >= 50 && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <AlertTriangle className="w-5 h-5 text-orange-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-orange-400">
                High Cost Amplification: {classification.costAmplification}x
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Each unprotected request to this endpoint may cost {classification.costAmplification} times
                more than a typical request. Without rate limiting, this could lead to significant
                financial damage from abuse.
              </p>
            </div>
          </div>
        )}

        {/* Missing Enforcement */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
            Missing Enforcement Controls
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {classification.missingEnforcement.map((control) => {
              const Icon = enforcementIcons[control] || ShieldOff;
              return (
                <div
                  key={control}
                  className="flex items-center gap-2 p-3 rounded-lg border border-red-500/20 bg-red-500/5"
                >
                  <Icon className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-400">{enforcementLabels[control] || control}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Confidence */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Classification confidence:</span>
          <span className={cn(
            "font-medium",
            classification.confidence >= 0.8 ? "text-emerald-400" :
            classification.confidence >= 0.6 ? "text-yellow-400" : "text-orange-400"
          )}>
            {Math.round(classification.confidence * 100)}%
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function LinksSection({ links }: { links: NonNullable<Finding["links"]> }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <ExternalLink className="w-5 h-5" />
          References
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          {links.owasp && (
            <a
              href={links.owasp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border bg-card hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ExternalLink className="w-4 h-4" />
              OWASP Reference
            </a>
          )}
          {links.cwe && (
            <a
              href={links.cwe}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border bg-card hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ExternalLink className="w-4 h-4" />
              CWE Reference
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function FindingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { artifacts, selectedArtifactId, isLoading } = useArtifactStore();

  // Get the finding ID from URL pathname directly to handle static export hydration
  // The pre-rendered placeholder page has id="placeholder" but we need the real ID from URL
  const [findingId, setFindingId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const pathParts = window.location.pathname.split("/");
      const urlId = pathParts[pathParts.length - 1];
      if (urlId && urlId !== "placeholder") {
        return decodeURIComponent(urlId);
      }
    }
    return decodeURIComponent(params.id as string);
  });

  // Update finding ID on client when URL changes
  useEffect(() => {
    const pathParts = window.location.pathname.split("/");
    const urlId = pathParts[pathParts.length - 1];
    if (urlId && urlId !== "placeholder") {
      setFindingId(decodeURIComponent(urlId));
    }
  }, [params.id]);

  const finding = useMemo(() => {
    // First try the selected artifact
    const selectedArtifact = artifacts.find((a) => a.id === selectedArtifactId);
    const fromSelected = selectedArtifact?.artifact.findings.find((f: Finding) => f.id === findingId);
    if (fromSelected) return fromSelected;

    // If not found in selected, search all artifacts
    for (const artifact of artifacts) {
      const found = artifact.artifact.findings.find((f: Finding) => f.id === findingId);
      if (found) return found;
    }
    return undefined;
  }, [artifacts, selectedArtifactId, findingId]);

  // Show loading state while store is initializing
  // isLoading starts false, so also check if we have no artifacts yet
  const storeNotReady = isLoading || artifacts.length === 0;

  if (storeNotReady && !finding) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!finding) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">Finding not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ViewModeProvider>
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to findings
        </Button>
        <DetailViewToggle />
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <SeverityBadge severity={finding.severity} size="lg" />
              <span className="text-sm text-muted-foreground font-mono">
                {finding.ruleId}
              </span>
              <span className="text-sm text-muted-foreground px-2 py-0.5 bg-muted rounded">
                {finding.category}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              {finding.title}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">Confidence</p>
              <div className="w-32">
                <ConfidenceMeter confidence={finding.confidence} />
              </div>
            </div>
          </div>
        </div>

        <p className="text-muted-foreground">{finding.description}</p>

        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <Fingerprint className="w-3 h-3" />
          {finding.fingerprint}
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <AIChatDialog finding={finding} />
          <SmartWaiverDialog
            finding={finding}
            onWaive={(reason, justification) => {
              console.log("Waived:", reason, justification);
              // TODO: Integrate with waiver store
            }}
          />
        </div>
      </motion.div>

      {/* AI-Native Developer Enhancements */}
      {finding.enhancements && (
        <>
          {/* Plain English Explanation */}
          {finding.enhancements.plainEnglish && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.05 }}
            >
              <PlainEnglishCard plainEnglish={finding.enhancements.plainEnglish} />
            </motion.div>
          )}

          {/* Severity Context */}
          {finding.enhancements.severityContext && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.07 }}
            >
              <SeverityContextCard
                severityContext={finding.enhancements.severityContext}
                severity={finding.severity}
              />
            </motion.div>
          )}

          {/* Code Comparison */}
          {finding.enhancements.codeComparison && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.09 }}
            >
              <CodeComparisonCard codeComparison={finding.enhancements.codeComparison} />
            </motion.div>
          )}
        </>
      )}

      {/* Evidence - Technical/Full view only */}
      <ViewModeContent modes={["technical", "full"]}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileCode className="w-5 h-5" />
                Evidence ({finding.evidence.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {finding.evidence.map((ev: EvidenceItem, i: number) => (
                <EvidenceCard key={i} evidence={ev} />
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </ViewModeContent>

      {/* Abuse Classification - Technical/Full view only */}
      <ViewModeContent modes={["technical", "full"]}>
        {finding.abuseClassification && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.12 }}
          >
            <AbuseClassificationSection classification={finding.abuseClassification} />
          </motion.div>
        )}
      </ViewModeContent>

      {/* Claim - Technical/Full view only */}
      <ViewModeContent modes={["technical", "full"]}>
        {finding.claim && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.15 }}
          >
            <ClaimSection claim={finding.claim} />
          </motion.div>
        )}
      </ViewModeContent>

      {/* Proof Trace - Technical/Full view only */}
      <ViewModeContent modes={["technical", "full"]}>
        {finding.proof && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Proof Trace</CardTitle>
              </CardHeader>
              <CardContent>
                <ProofTraceTimeline proof={finding.proof} />
              </CardContent>
            </Card>
          </motion.div>
        )}
      </ViewModeContent>

      {/* Remediation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.25 }}
      >
        <RemediationSection remediation={finding.remediation} />
      </motion.div>

      {/* Fix Steps Wizard */}
      {finding.enhancements?.fixSteps && finding.enhancements.fixSteps.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.27 }}
        >
          <FixStepsWizard steps={finding.enhancements.fixSteps} />
        </motion.div>
      )}

      {/* AI Prompt Copy */}
      {finding.enhancements?.aiPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.29 }}
        >
          <CopyToAIButton aiPrompt={finding.enhancements.aiPrompt} />
        </motion.div>
      )}

      {/* Links */}
      {finding.links && (finding.links.owasp || finding.links.cwe) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.3 }}
        >
          <LinksSection links={finding.links} />
        </motion.div>
      )}
    </div>
    </ViewModeProvider>
  );
}
