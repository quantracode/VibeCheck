"use client";

import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Network,
  Upload,
  Info,
  Layers,
  AlertTriangle,
  X,
  ExternalLink,
} from "lucide-react";
import { useArtifactStore } from "@/lib/store";
import { buildApplicationGraph, type GraphNode, type SecurityGap } from "@/lib/graph-builder";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { ArchitectureGraph, GraphLegend } from "@/components/ArchitectureGraph";
import { BestPracticePanel } from "@/components/BestPracticePanel";
import { SecurityGapsPanel, GapDetail } from "@/components/SecurityGapsPanel";
import { FeatureGate } from "@/components/license";
import { cn } from "@/lib/utils";
import type { Finding } from "@vibecheck/schema";

// ============================================================================
// Types
// ============================================================================

interface SelectedNodeInfo {
  node: GraphNode;
  findings: Finding[];
}

// ============================================================================
// Page Component
// ============================================================================

export default function ArchitecturePage() {
  const { artifacts, selectedArtifactId } = useArtifactStore();
  const selectedArtifact = useMemo(
    () => artifacts.find((a) => a.id === selectedArtifactId),
    [artifacts, selectedArtifactId]
  );

  const [selectedNode, setSelectedNode] = useState<SelectedNodeInfo | null>(null);
  const [selectedGap, setSelectedGap] = useState<SecurityGap | null>(null);
  const [highlightedNodes, setHighlightedNodes] = useState<string[]>([]);

  // Build the application graph
  const graph = useMemo(() => {
    if (!selectedArtifact) return null;
    return buildApplicationGraph(selectedArtifact.artifact);
  }, [selectedArtifact]);

  // Handle node click
  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (!selectedArtifact) return;

      const findings = selectedArtifact.artifact.findings.filter((f) =>
        node.findingIds.includes(f.id)
      );

      setSelectedNode({ node, findings });
      setSelectedGap(null);
      setHighlightedNodes([node.id]);
    },
    [selectedArtifact]
  );

  // Handle gap click
  const handleGapClick = useCallback((gap: SecurityGap) => {
    setSelectedGap(gap);
    setSelectedNode(null);
    setHighlightedNodes(gap.affectedNodes);
  }, []);

  // Handle highlight nodes from gap detail
  const handleHighlightNodes = useCallback((nodeIds: string[]) => {
    setHighlightedNodes(nodeIds);
  }, []);

  // Close detail panel
  const closeDetailPanel = useCallback(() => {
    setSelectedNode(null);
    setSelectedGap(null);
    setHighlightedNodes([]);
  }, []);

  // No artifact loaded
  if (!selectedArtifact) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            Architecture Map
            <span className="px-2 py-1 text-xs font-medium bg-purple-500/10 text-purple-400 rounded-md border border-purple-500/20">
              Pro
            </span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Visual security architecture analysis
          </p>
        </div>
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<Upload className="w-8 h-8 text-muted-foreground" />}
              title="No artifact loaded"
              description="Import a scan artifact from the Dashboard to view the architecture map."
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
    <FeatureGate feature="architecture_maps">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              Architecture Map
              <span className="px-2 py-1 text-xs font-medium bg-purple-500/10 text-purple-400 rounded-md border border-purple-500/20">
                Pro
              </span>
            </h1>
            <p className="text-muted-foreground mt-1">
              Visual representation of your security architecture
            </p>
          </div>
          {graph && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4" />
                <span>{graph.meta.totalRoutes} routes</span>
              </div>
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4" />
                <span>{graph.meta.totalFiles} files</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>{graph.meta.totalFindings} findings</span>
              </div>
            </div>
          )}
        </div>

        {graph && (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* Main Graph Area */}
            <div className="xl:col-span-3 space-y-4">
              {/* Graph Container */}
              <Card className="overflow-hidden">
                <ArchitectureGraph
                  graph={graph}
                  width={900}
                  height={600}
                  onNodeClick={handleNodeClick}
                  selectedNodeId={selectedNode?.node.id}
                  highlightedNodeIds={highlightedNodes}
                  className="w-full h-[600px]"
                />
              </Card>

              {/* Legend Card (horizontal) */}
              <Card>
                <CardContent className="p-4">
                  <GraphLegend horizontal />
                </CardContent>
              </Card>

              {/* Bottom Info Bar */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Info className="w-4 h-4" />
                  <span>Click nodes to view details. Scroll to zoom. Drag to pan.</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Coverage Score:</span>
                    <span
                      className={cn(
                        "font-medium text-sm",
                        graph.meta.coverageScore >= 80
                          ? "text-emerald-400"
                          : graph.meta.coverageScore >= 50
                            ? "text-yellow-400"
                            : "text-red-400"
                      )}
                    >
                      {graph.meta.coverageScore}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Risk Score:</span>
                    <span
                      className={cn(
                        "font-medium text-sm",
                        graph.meta.riskScore === 0
                          ? "text-emerald-400"
                          : graph.meta.riskScore < 10
                            ? "text-yellow-400"
                            : "text-red-400"
                      )}
                    >
                      {graph.meta.riskScore}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Side Panel */}
            <div className="space-y-4">
              {/* Detail Panel (when node or gap selected) */}
              {(selectedNode || selectedGap) && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <Card>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <CardTitle className="text-base">
                        {selectedNode ? "Node Details" : "Gap Details"}
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={closeDetailPanel}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {selectedNode ? (
                        <NodeDetailPanel
                          node={selectedNode.node}
                          findings={selectedNode.findings}
                        />
                      ) : selectedGap ? (
                        <GapDetail
                          gap={selectedGap}
                          onHighlightNodes={handleHighlightNodes}
                        />
                      ) : null}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Security Gaps */}
              <SecurityGapsPanel graph={graph} onGapClick={handleGapClick} />

              {/* Best Practice Reference */}
              <BestPracticePanel />
            </div>
          </div>
        )}
      </div>
    </FeatureGate>
  );
}

// ============================================================================
// Node Detail Panel
// ============================================================================

function NodeDetailPanel({
  node,
  findings,
}: {
  node: GraphNode;
  findings: Finding[];
}) {
  const riskColors = {
    none: "text-emerald-400",
    low: "text-blue-400",
    medium: "text-yellow-400",
    high: "text-orange-400",
    critical: "text-red-400",
  };

  return (
    <div className="space-y-4">
      {/* Node Info */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{
              backgroundColor:
                node.risk === "critical"
                  ? "#ef4444"
                  : node.risk === "high"
                    ? "#f97316"
                    : node.risk === "medium"
                      ? "#f59e0b"
                      : node.risk === "low"
                        ? "#3b82f6"
                        : "#22c55e",
            }}
          />
          <h3 className="font-medium">{node.label}</h3>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-zinc-500">Type:</span>
            <span className="ml-2 text-zinc-300 capitalize">{node.type}</span>
          </div>
          <div>
            <span className="text-zinc-500">Risk:</span>
            <span className={cn("ml-2 capitalize", riskColors[node.risk])}>
              {node.risk}
            </span>
          </div>
        </div>

        {node.file && (
          <div className="text-xs font-mono text-zinc-500 truncate">
            {node.file}
            {node.line && `:${node.line}`}
          </div>
        )}
      </div>

      {/* Protection Status */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
          Protection Status
        </p>
        <div className="grid grid-cols-2 gap-2">
          <StatusBadge label="Auth" active={node.hasAuth} />
          <StatusBadge label="Middleware" active={node.middlewareCovered} />
          <StatusBadge label="Validation" active={node.hasValidation} />
          <StatusBadge label="Rate Limit" active={node.hasRateLimit} />
        </div>
      </div>

      {/* Findings */}
      {findings.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
            Findings ({findings.length})
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {findings.map((finding) => (
              <Link
                key={finding.id}
                href={`/findings/${encodeURIComponent(finding.id)}`}
                className="block p-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-200 truncate">
                      {finding.title}
                    </p>
                    <p className="text-[10px] text-zinc-500 font-mono">
                      {finding.ruleId}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded capitalize",
                      finding.severity === "critical"
                        ? "bg-red-500/20 text-red-400"
                        : finding.severity === "high"
                          ? "bg-orange-500/20 text-orange-400"
                          : finding.severity === "medium"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-blue-500/20 text-blue-400"
                    )}
                  >
                    {finding.severity}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {findings.length === 0 && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-sm text-emerald-400">No findings for this node</p>
        </div>
      )}

      {/* View Findings Link */}
      {findings.length > 0 && (
        <Link href="/findings">
          <Button variant="outline" size="sm" className="w-full gap-2">
            View All Findings
            <ExternalLink className="w-3 h-3" />
          </Button>
        </Link>
      )}
    </div>
  );
}

function StatusBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={cn(
        "px-2 py-1 text-xs rounded text-center",
        active
          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
          : "bg-zinc-800/50 text-zinc-500 border border-zinc-700/30"
      )}
    >
      {label}
    </div>
  );
}
