/**
 * Trace Graph Builder
 *
 * Builds a deterministic graph representation from proofTraces
 * for visualization of request flow through route handlers.
 */

import type {
  ScanArtifact,
  RouteEntry,
  Finding,
} from "@vibecheck/schema";

// ============================================================================
// Types
// ============================================================================

export type TraceNodeKind =
  | "request"
  | "middleware"
  | "handler"
  | "function"
  | "validator"
  | "sink"
  | "response";

export interface TraceGraphNode {
  id: string;
  kind: TraceNodeKind;
  label: string;
  file?: string;
  line?: number;
  snippet?: string;
  findingIds: string[];
  /** Position for deterministic layout */
  x: number;
  y: number;
  /** Layer index for deterministic layout */
  layer: number;
}

export interface TraceGraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface TraceGraph {
  routeId: string;
  routeLabel: string;
  nodes: TraceGraphNode[];
  edges: TraceGraphEdge[];
}

// ============================================================================
// Proof Trace Types (from artifact)
// ============================================================================

interface ProofNode {
  kind: string;
  label: string;
  file?: string;
  line?: number;
}

interface ProofTrace {
  summary: string;
  nodes: ProofNode[];
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate deterministic node ID
 */
function generateNodeId(routeId: string, kind: string, index: number): string {
  return `${routeId}:${kind}:${index}`;
}

/**
 * Generate deterministic edge ID
 */
function generateEdgeId(source: string, target: string): string {
  return `${source}->${target}`;
}

/**
 * Map proof node kind to trace node kind
 */
function mapProofKindToTraceKind(proofKind: string): TraceNodeKind {
  switch (proofKind.toLowerCase()) {
    case "route":
      return "handler";
    case "middleware":
      return "middleware";
    case "handler":
      return "handler";
    case "function":
      return "function";
    case "sink":
      return "sink";
    case "config":
      return "function";
    default:
      return "function";
  }
}

/**
 * Determine if a node represents validation based on its label
 */
function isValidationNode(label: string): boolean {
  const validationPatterns = [
    /valid/i,
    /zod/i,
    /schema/i,
    /parse/i,
    /safeParse/i,
    /sanitize/i,
    /check/i,
  ];
  return validationPatterns.some((p) => p.test(label));
}

/**
 * Determine if a node represents a sink (DB, external API, etc.)
 */
function isSinkNode(label: string): boolean {
  const sinkPatterns = [
    /prisma/i,
    /database/i,
    /db\./i,
    /fetch/i,
    /axios/i,
    /sql/i,
    /query/i,
    /insert/i,
    /update/i,
    /delete/i,
    /create/i,
    /\.save/i,
    /\.exec/i,
    /sendEmail/i,
    /stripe/i,
    /payment/i,
  ];
  return sinkPatterns.some((p) => p.test(label));
}

// ============================================================================
// Layout Algorithm
// ============================================================================

const LAYER_SPACING = 120;
const NODE_SPACING = 150;
const GRAPH_PADDING = 80;

/**
 * Apply deterministic hierarchical layout to trace graph
 * Nodes are organized in layers from top to bottom:
 * request -> middleware -> handler -> functions/validators -> sinks -> response
 */
function applyDeterministicLayout(nodes: TraceGraphNode[], edges: TraceGraphEdge[]): void {
  // Group nodes by layer
  const nodesByLayer = new Map<number, TraceGraphNode[]>();
  for (const node of nodes) {
    if (!nodesByLayer.has(node.layer)) {
      nodesByLayer.set(node.layer, []);
    }
    nodesByLayer.get(node.layer)!.push(node);
  }

  // Sort nodes within each layer alphabetically by label for determinism
  for (const [layer, layerNodes] of nodesByLayer) {
    layerNodes.sort((a, b) => a.label.localeCompare(b.label));
  }

  // Calculate positions
  const maxNodesInLayer = Math.max(...Array.from(nodesByLayer.values()).map((n) => n.length));
  const graphWidth = Math.max(400, maxNodesInLayer * NODE_SPACING + GRAPH_PADDING * 2);

  for (const [layer, layerNodes] of nodesByLayer) {
    const y = GRAPH_PADDING + layer * LAYER_SPACING;
    const totalWidth = (layerNodes.length - 1) * NODE_SPACING;
    const startX = (graphWidth - totalWidth) / 2;

    layerNodes.forEach((node, index) => {
      node.x = startX + index * NODE_SPACING;
      node.y = y;
    });
  }
}

// ============================================================================
// Graph Building
// ============================================================================

/**
 * Get routes from artifact (handles both legacy and new format)
 */
function getRoutes(artifact: ScanArtifact): RouteEntry[] {
  if (!artifact.routeMap) return [];
  if (Array.isArray(artifact.routeMap)) return artifact.routeMap;
  return artifact.routeMap.routes ?? [];
}

/**
 * Get proof traces from artifact
 */
function getProofTraces(artifact: ScanArtifact): Map<string, ProofTrace> {
  const traces = artifact.proofTraces;
  if (!traces || typeof traces !== "object") return new Map();
  return new Map(Object.entries(traces as Record<string, ProofTrace>));
}

/**
 * Get findings related to a specific route/file
 */
function getRelatedFindings(
  findings: Finding[],
  file?: string,
  line?: number
): string[] {
  if (!file) return [];
  return findings
    .filter((f) => {
      const evidence = f.evidence[0];
      if (!evidence) return false;
      const normalizedFile = file.replace(/\\/g, "/");
      const evidenceFile = evidence.file.replace(/\\/g, "/");
      if (!evidenceFile.includes(normalizedFile) && !normalizedFile.includes(evidenceFile)) {
        return false;
      }
      // If line is specified, check if it's within range
      if (line && evidence.startLine && evidence.endLine) {
        return line >= evidence.startLine && line <= evidence.endLine;
      }
      return true;
    })
    .map((f) => f.id);
}

/**
 * Build trace graph for a specific route from proofTraces
 */
export function buildTraceGraph(
  artifact: ScanArtifact,
  routeId: string
): TraceGraph | null {
  const routes = getRoutes(artifact);
  const proofTraces = getProofTraces(artifact);
  const findings = artifact.findings;

  // Find the route
  const route = routes.find((r) => r.routeId === routeId);
  if (!route) return null;

  // Get proof trace for this route
  const proofTrace = proofTraces.get(routeId);
  const nodes: TraceGraphNode[] = [];
  const edges: TraceGraphEdge[] = [];

  // Create request node (entry point)
  const requestNodeId = generateNodeId(routeId, "request", 0);
  nodes.push({
    id: requestNodeId,
    kind: "request",
    label: `${route.method} ${route.path}`,
    findingIds: [],
    x: 0,
    y: 0,
    layer: 0,
  });

  let previousNodeId = requestNodeId;
  let currentLayer = 1;
  let nodeIndex = 0;

  if (proofTrace && proofTrace.nodes.length > 0) {
    // Build nodes from proof trace
    for (const proofNode of proofTrace.nodes) {
      let kind: TraceNodeKind = mapProofKindToTraceKind(proofNode.kind);

      // Refine kind based on label analysis
      if (isValidationNode(proofNode.label)) {
        kind = "validator";
      } else if (isSinkNode(proofNode.label)) {
        kind = "sink";
      }

      // Determine layer based on kind
      let layer: number;
      switch (kind) {
        case "middleware":
          layer = 1;
          break;
        case "handler":
          layer = 2;
          break;
        case "validator":
          layer = 3;
          break;
        case "function":
          layer = 3;
          break;
        case "sink":
          layer = 4;
          break;
        default:
          layer = currentLayer;
      }

      const nodeId = generateNodeId(routeId, kind, nodeIndex++);
      const relatedFindings = getRelatedFindings(
        findings,
        proofNode.file,
        proofNode.line
      );

      nodes.push({
        id: nodeId,
        kind,
        label: proofNode.label,
        file: proofNode.file,
        line: proofNode.line,
        findingIds: relatedFindings,
        x: 0,
        y: 0,
        layer,
      });

      // Create edge from previous node
      edges.push({
        id: generateEdgeId(previousNodeId, nodeId),
        source: previousNodeId,
        target: nodeId,
      });

      previousNodeId = nodeId;
      currentLayer = layer + 1;
    }
  } else {
    // No proof trace available, create basic handler node
    const handlerNodeId = generateNodeId(routeId, "handler", nodeIndex++);
    const handlerFindings = getRelatedFindings(findings, route.file, route.startLine);

    nodes.push({
      id: handlerNodeId,
      kind: "handler",
      label: route.handlerSymbol || route.handler || `${route.method} handler`,
      file: route.file,
      line: route.startLine,
      findingIds: handlerFindings,
      x: 0,
      y: 0,
      layer: 2,
    });

    edges.push({
      id: generateEdgeId(requestNodeId, handlerNodeId),
      source: requestNodeId,
      target: handlerNodeId,
    });

    previousNodeId = handlerNodeId;
  }

  // Create response node (exit point)
  const responseNodeId = generateNodeId(routeId, "response", nodeIndex);
  const maxLayer = Math.max(...nodes.map((n) => n.layer)) + 1;
  nodes.push({
    id: responseNodeId,
    kind: "response",
    label: "Response",
    findingIds: [],
    x: 0,
    y: 0,
    layer: maxLayer,
  });

  edges.push({
    id: generateEdgeId(previousNodeId, responseNodeId),
    source: previousNodeId,
    target: responseNodeId,
  });

  // Apply deterministic layout
  applyDeterministicLayout(nodes, edges);

  return {
    routeId,
    routeLabel: `${route.method} ${route.path}`,
    nodes,
    edges,
  };
}

/**
 * Build trace graphs for all routes
 */
export function buildAllTraceGraphs(artifact: ScanArtifact): Map<string, TraceGraph> {
  const routes = getRoutes(artifact);
  const graphs = new Map<string, TraceGraph>();

  for (const route of routes) {
    const graph = buildTraceGraph(artifact, route.routeId);
    if (graph) {
      graphs.set(route.routeId, graph);
    }
  }

  return graphs;
}

/**
 * Get graph dimensions for rendering
 */
export function getGraphDimensions(graph: TraceGraph): { width: number; height: number } {
  if (graph.nodes.length === 0) {
    return { width: 400, height: 300 };
  }

  const maxX = Math.max(...graph.nodes.map((n) => n.x));
  const maxY = Math.max(...graph.nodes.map((n) => n.y));

  return {
    width: maxX + GRAPH_PADDING * 2,
    height: maxY + GRAPH_PADDING * 2,
  };
}
