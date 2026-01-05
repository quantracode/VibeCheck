"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitBranch,
  Search,
  ChevronDown,
  Upload,
  FileSearch,
  AlertTriangle,
  FileCode,
  X,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { useArtifactStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { TraceGraphView, TraceGraphLegend } from "@/components/TraceGraph";
import { buildTraceGraph, type TraceGraph, type TraceGraphNode } from "@/lib/trace-graph-builder";
import { cn } from "@/lib/utils";
import type { RouteEntry, Finding } from "@vibecheck/schema";

// ============================================================================
// Types
// ============================================================================

interface Route {
  routeId: string;
  method: string;
  path: string;
  file: string;
  startLine?: number;
}

// ============================================================================
// Helpers
// ============================================================================

const methodColors: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  POST: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  PUT: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  PATCH: "bg-orange-500/10 text-orange-500 border-orange-500/30",
  DELETE: "bg-red-500/10 text-red-500 border-red-500/30",
};

// ============================================================================
// Main Component
// ============================================================================

export default function TraceGraphPage() {
  const { artifacts, selectedArtifactId } = useArtifactStore();
  const selectedArtifact = useMemo(
    () => artifacts.find((a) => a.id === selectedArtifactId),
    [artifacts, selectedArtifactId]
  );

  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState<TraceGraphNode | null>(null);

  // Extract routes from artifact
  const routes: Route[] = useMemo(() => {
    const routeMap = selectedArtifact?.artifact.routeMap;
    if (!routeMap) return [];
    if (Array.isArray(routeMap)) return routeMap as Route[];
    if ("routes" in routeMap && Array.isArray(routeMap.routes)) {
      return routeMap.routes as Route[];
    }
    return [];
  }, [selectedArtifact]);

  // Filter routes by search
  const filteredRoutes = useMemo(() => {
    if (!searchQuery.trim()) return routes;
    const query = searchQuery.toLowerCase();
    return routes.filter(
      (r) =>
        r.path.toLowerCase().includes(query) ||
        r.method.toLowerCase().includes(query) ||
        r.file.toLowerCase().includes(query)
    );
  }, [routes, searchQuery]);

  // Build graph for selected route
  const traceGraph = useMemo<TraceGraph | null>(() => {
    if (!selectedArtifact || !selectedRouteId) return null;
    return buildTraceGraph(selectedArtifact.artifact, selectedRouteId);
  }, [selectedArtifact, selectedRouteId]);

  // Get findings for selected node
  const nodeFindings = useMemo<Finding[]>(() => {
    if (!selectedNode || !selectedArtifact) return [];
    return selectedArtifact.artifact.findings.filter((f) =>
      selectedNode.findingIds.includes(f.id)
    );
  }, [selectedNode, selectedArtifact]);

  // Handle node click
  const handleNodeClick = useCallback((node: TraceGraphNode) => {
    setSelectedNode(node);
  }, []);

  // Close node details panel
  const closeNodeDetails = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Auto-select first route if none selected
  useMemo(() => {
    if (routes.length > 0 && !selectedRouteId) {
      setSelectedRouteId(routes[0].routeId);
    }
  }, [routes, selectedRouteId]);

  // No artifact loaded
  if (!selectedArtifact) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <GitBranch className="w-8 h-8 text-emerald-500" />
            Trace Graph
          </h1>
          <p className="text-muted-foreground mt-1">
            Interactive visualization of request flow through route handlers
          </p>
        </div>
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<Upload className="w-8 h-8 text-muted-foreground" />}
              title="No artifact loaded"
              description="Import a scan artifact from the Dashboard to view trace graphs."
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

  // No routes in artifact
  if (routes.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <GitBranch className="w-8 h-8 text-emerald-500" />
            Trace Graph
          </h1>
          <p className="text-muted-foreground mt-1">
            Interactive visualization of request flow through route handlers
          </p>
        </div>
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<FileSearch className="w-8 h-8 text-muted-foreground" />}
              title="No routes found"
              description="This artifact doesn't contain route data. Re-scan with --emit-route-map to generate it."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <GitBranch className="w-8 h-8 text-emerald-500" />
            Trace Graph
          </h1>
          <p className="text-muted-foreground mt-1">
            Select a route to visualize its request flow
          </p>
        </div>

        {/* Route selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search routes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              aria-label="Search routes"
            />
          </div>

          <Select
            value={selectedRouteId ?? ""}
            onValueChange={(value) => {
              setSelectedRouteId(value);
              setSelectedNode(null);
            }}
          >
            <SelectTrigger className="w-[300px]" aria-label="Select route">
              <SelectValue placeholder="Select a route">
                {selectedRouteId && (
                  <span className="font-mono text-sm">
                    {routes.find((r) => r.routeId === selectedRouteId)?.method}{" "}
                    {routes.find((r) => r.routeId === selectedRouteId)?.path}
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-[400px]">
              {filteredRoutes.map((route) => (
                <SelectItem key={route.routeId} value={route.routeId}>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-bold border",
                        methodColors[route.method] ?? methodColors.GET
                      )}
                    >
                      {route.method}
                    </span>
                    <span className="font-mono text-sm">{route.path}</span>
                  </div>
                </SelectItem>
              ))}
              {filteredRoutes.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  No routes match your search
                </div>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Graph and Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graph */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            {traceGraph ? (
              <TraceGraphView
                graph={traceGraph}
                onNodeClick={handleNodeClick}
                selectedNodeId={selectedNode?.id}
                highlightedNodeIds={selectedNode ? [selectedNode.id] : []}
                className="min-h-[500px]"
              />
            ) : (
              <CardContent className="p-0">
                <EmptyState
                  icon={<FileSearch className="w-8 h-8 text-muted-foreground" />}
                  title="No graph data"
                  description="Select a route to view its trace graph."
                />
              </CardContent>
            )}
          </Card>

          {/* Legend */}
          <TraceGraphLegend className="mt-4" />
        </div>

        {/* Details Panel */}
        <div className="lg:col-span-1">
          <AnimatePresence mode="wait">
            {selectedNode ? (
              <motion.div
                key={selectedNode.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <span
                          className={cn(
                            "inline-block px-2 py-0.5 rounded text-xs font-medium capitalize mb-2",
                            selectedNode.kind === "request" && "bg-blue-500/20 text-blue-400",
                            selectedNode.kind === "middleware" && "bg-purple-500/20 text-purple-400",
                            selectedNode.kind === "handler" && "bg-emerald-500/20 text-emerald-400",
                            selectedNode.kind === "function" && "bg-amber-500/20 text-amber-400",
                            selectedNode.kind === "validator" && "bg-cyan-500/20 text-cyan-400",
                            selectedNode.kind === "sink" && "bg-red-500/20 text-red-400",
                            selectedNode.kind === "response" && "bg-green-500/20 text-green-400"
                          )}
                        >
                          {selectedNode.kind}
                        </span>
                        <h3 className="font-semibold text-lg break-all">
                          {selectedNode.label}
                        </h3>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={closeNodeDetails}
                        className="h-8 w-8"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Location */}
                    {selectedNode.file && (
                      <div className="mb-4 p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                          <FileCode className="w-4 h-4" />
                          <span>Location</span>
                        </div>
                        <p className="font-mono text-sm break-all">
                          {selectedNode.file}
                          {selectedNode.line && `:${selectedNode.line}`}
                        </p>
                      </div>
                    )}

                    {/* Findings */}
                    {nodeFindings.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-amber-400">
                          <AlertTriangle className="w-4 h-4" />
                          <span>{nodeFindings.length} Finding{nodeFindings.length !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="space-y-2">
                          {nodeFindings.map((finding) => (
                            <Link
                              key={finding.id}
                              href={`/findings#${finding.id}`}
                              className="block p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <span
                                    className={cn(
                                      "inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase mb-1",
                                      finding.severity === "critical" && "bg-red-500/20 text-red-400",
                                      finding.severity === "high" && "bg-orange-500/20 text-orange-400",
                                      finding.severity === "medium" && "bg-yellow-500/20 text-yellow-400",
                                      finding.severity === "low" && "bg-blue-500/20 text-blue-400"
                                    )}
                                  >
                                    {finding.severity}
                                  </span>
                                  <p className="text-sm font-medium">{finding.title}</p>
                                  <p className="text-xs text-muted-foreground font-mono mt-1">
                                    {finding.ruleId}
                                  </p>
                                </div>
                                <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No findings */}
                    {nodeFindings.length === 0 && selectedNode.kind !== "request" && selectedNode.kind !== "response" && (
                      <div className="text-center py-6">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 mb-3">
                          <svg
                            className="w-6 h-6 text-emerald-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          No security findings for this node
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Card>
                  <CardContent className="p-6 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                      <GitBranch className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Click a node in the graph to view its details
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Route Info Card */}
          {selectedRouteId && (
            <Card className="mt-4">
              <CardContent className="p-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">
                  Selected Route
                </h4>
                {(() => {
                  const route = routes.find((r) => r.routeId === selectedRouteId);
                  if (!route) return null;
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-xs font-bold border",
                            methodColors[route.method] ?? methodColors.GET
                          )}
                        >
                          {route.method}
                        </span>
                        <span className="font-mono text-sm">{route.path}</span>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                        <FileCode className="w-3 h-3" />
                        {route.file}
                        {route.startLine && `:${route.startLine}`}
                      </p>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
