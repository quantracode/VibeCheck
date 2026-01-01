"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  FileCode,
  ExternalLink,
  Lightbulb,
  Shield,
  Fingerprint,
} from "lucide-react";
import { useArtifactStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeverityBadge } from "@/components/SeverityBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { EvidenceCard } from "@/components/EvidenceCard";
import { ProofTraceTimeline } from "@/components/ProofTraceTimeline";
import type { Finding, EvidenceItem } from "@vibecheck/schema";

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
  const { artifacts, selectedArtifactId } = useArtifactStore();

  const findingId = decodeURIComponent(params.id as string);

  const finding = useMemo(() => {
    const selectedArtifact = artifacts.find((a) => a.id === selectedArtifactId);
    return selectedArtifact?.artifact.findings.find((f: Finding) => f.id === findingId);
  }, [artifacts, selectedArtifactId, findingId]);

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
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => router.back()}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to findings
      </Button>

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
      </motion.div>

      {/* Evidence */}
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

      {/* Claim */}
      {finding.claim && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.15 }}
        >
          <ClaimSection claim={finding.claim} />
        </motion.div>
      )}

      {/* Proof Trace */}
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

      {/* Remediation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.25 }}
      >
        <RemediationSection remediation={finding.remediation} />
      </motion.div>

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
  );
}
