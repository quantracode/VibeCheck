/**
 * Trace Graph Tests
 *
 * Tests for the trace graph derivation and determinism.
 * These tests verify that the proof trace to graph conversion
 * produces consistent, deterministic output.
 */

import { describe, it, expect } from "vitest";
import type { ScanArtifact, ProofTrace, RouteEntry } from "@vibecheck/schema";

// ============================================================================
// Graph Builder Types (Mirror of web lib/trace-graph-builder.ts)
// ============================================================================

type TraceNodeKind =
  | "request"
  | "middleware"
  | "handler"
  | "function"
  | "validator"
  | "sink"
  | "response";

interface TraceGraphNode {
  id: string;
  kind: TraceNodeKind;
  label: string;
  file?: string;
  line?: number;
  findingIds: string[];
  x: number;
  y: number;
  layer: number;
}

interface TraceGraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

interface TraceGraph {
  routeId: string;
  routeLabel: string;
  nodes: TraceGraphNode[];
  edges: TraceGraphEdge[];
}

// ============================================================================
// Graph Builder Implementation (Inline for testing without web dependencies)
// ============================================================================

function generateNodeId(routeId: string, kind: string, index: number): string {
  return `${routeId}:${kind}:${index}`;
}

function generateEdgeId(source: string, target: string): string {
  return `${source}->${target}`;
}

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

function isValidationNode(label: string): boolean {
  const validationPatterns = [/valid/i, /zod/i, /schema/i, /parse/i, /safeParse/i];
  return validationPatterns.some((p) => p.test(label));
}

function isSinkNode(label: string): boolean {
  const sinkPatterns = [/prisma/i, /database/i, /fetch/i, /query/i, /insert/i, /update/i, /delete/i];
  return sinkPatterns.some((p) => p.test(label));
}

const LAYER_SPACING = 120;
const NODE_SPACING = 150;
const GRAPH_PADDING = 80;

function applyDeterministicLayout(nodes: TraceGraphNode[]): void {
  const nodesByLayer = new Map<number, TraceGraphNode[]>();
  for (const node of nodes) {
    if (!nodesByLayer.has(node.layer)) {
      nodesByLayer.set(node.layer, []);
    }
    nodesByLayer.get(node.layer)!.push(node);
  }

  // Sort nodes within each layer alphabetically for determinism
  for (const [, layerNodes] of nodesByLayer) {
    layerNodes.sort((a, b) => a.label.localeCompare(b.label));
  }

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

function buildTraceGraph(artifact: ScanArtifact, routeId: string): TraceGraph | null {
  const routeMap = artifact.routeMap;
  const routes: RouteEntry[] = routeMap
    ? Array.isArray(routeMap)
      ? routeMap
      : routeMap.routes ?? []
    : [];

  const proofTraces = artifact.proofTraces ?? {};

  const route = routes.find((r) => r.routeId === routeId);
  if (!route) return null;

  const proofTrace = proofTraces[routeId] as ProofTrace | undefined;
  const nodes: TraceGraphNode[] = [];
  const edges: TraceGraphEdge[] = [];

  // Create request node
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
  let nodeIndex = 0;

  if (proofTrace && proofTrace.nodes.length > 0) {
    for (const proofNode of proofTrace.nodes) {
      let kind: TraceNodeKind = mapProofKindToTraceKind(proofNode.kind);

      if (isValidationNode(proofNode.label)) {
        kind = "validator";
      } else if (isSinkNode(proofNode.label)) {
        kind = "sink";
      }

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
          layer = 3;
      }

      const nodeId = generateNodeId(routeId, kind, nodeIndex++);
      nodes.push({
        id: nodeId,
        kind,
        label: proofNode.label,
        file: proofNode.file,
        line: proofNode.line,
        findingIds: [],
        x: 0,
        y: 0,
        layer,
      });

      edges.push({
        id: generateEdgeId(previousNodeId, nodeId),
        source: previousNodeId,
        target: nodeId,
      });

      previousNodeId = nodeId;
    }
  } else {
    const handlerNodeId = generateNodeId(routeId, "handler", nodeIndex++);
    nodes.push({
      id: handlerNodeId,
      kind: "handler",
      label: route.handlerSymbol || `${route.method} handler`,
      file: route.file,
      line: route.startLine,
      findingIds: [],
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

  // Create response node
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

  applyDeterministicLayout(nodes);

  return {
    routeId,
    routeLabel: `${route.method} ${route.path}`,
    nodes,
    edges,
  };
}

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockArtifact = (proofTraces?: Record<string, ProofTrace>): ScanArtifact => ({
  artifactVersion: "0.3",
  generatedAt: new Date().toISOString(),
  tool: { name: "vibecheck", version: "1.0.0" },
  summary: {
    totalFindings: 0,
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    byCategory: {
      auth: 0,
      validation: 0,
      middleware: 0,
      secrets: 0,
      injection: 0,
      privacy: 0,
      config: 0,
      network: 0,
      crypto: 0,
      uploads: 0,
      hallucinations: 0,
      abuse: 0,
      correlation: 0,
      authorization: 0,
      lifecycle: 0,
      "supply-chain": 0,
      other: 0,
    },
  },
  findings: [],
  routeMap: {
    routes: [
      {
        routeId: "route:POST:/api/users",
        method: "POST",
        path: "/api/users",
        file: "app/api/users/route.ts",
        startLine: 5,
        endLine: 25,
      },
      {
        routeId: "route:GET:/api/users",
        method: "GET",
        path: "/api/users",
        file: "app/api/users/route.ts",
        startLine: 27,
        endLine: 40,
      },
    ],
  },
  proofTraces,
});

// ============================================================================
// Tests
// ============================================================================

describe("Trace Graph Builder", () => {
  describe("Graph Derivation", () => {
    it("should build a basic graph from route without proof trace", () => {
      const artifact = createMockArtifact();
      const graph = buildTraceGraph(artifact, "route:POST:/api/users");

      expect(graph).not.toBeNull();
      expect(graph!.routeId).toBe("route:POST:/api/users");
      expect(graph!.routeLabel).toBe("POST /api/users");

      // Should have request, handler, and response nodes
      expect(graph!.nodes).toHaveLength(3);
      expect(graph!.nodes.map((n) => n.kind)).toEqual(["request", "handler", "response"]);

      // Should have 2 edges connecting them
      expect(graph!.edges).toHaveLength(2);
    });

    it("should build a graph with proof trace nodes", () => {
      const artifact = createMockArtifact({
        "route:POST:/api/users": {
          summary: "POST handler with validation and db insert",
          nodes: [
            { kind: "handler", label: "POST handler", file: "app/api/users/route.ts", line: 5 },
            { kind: "function", label: "zodSchema.parse", file: "app/api/users/route.ts", line: 8 },
            { kind: "sink", label: "prisma.user.create", file: "app/api/users/route.ts", line: 15 },
          ],
        },
      });

      const graph = buildTraceGraph(artifact, "route:POST:/api/users");

      expect(graph).not.toBeNull();
      // request + 3 trace nodes + response = 5
      expect(graph!.nodes).toHaveLength(5);

      // Check node kinds are correctly mapped
      const kinds = graph!.nodes.map((n) => n.kind);
      expect(kinds).toContain("request");
      expect(kinds).toContain("handler");
      expect(kinds).toContain("validator"); // zodSchema.parse should be detected as validator
      expect(kinds).toContain("sink");
      expect(kinds).toContain("response");
    });

    it("should return null for non-existent route", () => {
      const artifact = createMockArtifact();
      const graph = buildTraceGraph(artifact, "route:DELETE:/api/nonexistent");

      expect(graph).toBeNull();
    });

    it("should correctly detect validation nodes", () => {
      const artifact = createMockArtifact({
        "route:POST:/api/users": {
          summary: "Handler with validation",
          nodes: [
            { kind: "function", label: "schema.safeParse", file: "route.ts", line: 5 },
            { kind: "function", label: "validateInput", file: "route.ts", line: 10 },
            { kind: "function", label: "zodValidator", file: "route.ts", line: 15 },
          ],
        },
      });

      const graph = buildTraceGraph(artifact, "route:POST:/api/users");
      const validatorNodes = graph!.nodes.filter((n) => n.kind === "validator");

      expect(validatorNodes).toHaveLength(3);
    });

    it("should correctly detect sink nodes", () => {
      const artifact = createMockArtifact({
        "route:POST:/api/users": {
          summary: "Handler with sinks",
          nodes: [
            { kind: "function", label: "prisma.user.create", file: "route.ts", line: 5 },
            { kind: "function", label: "fetch(externalApi)", file: "route.ts", line: 10 },
            { kind: "function", label: "db.query", file: "route.ts", line: 15 },
          ],
        },
      });

      const graph = buildTraceGraph(artifact, "route:POST:/api/users");
      const sinkNodes = graph!.nodes.filter((n) => n.kind === "sink");

      expect(sinkNodes).toHaveLength(3);
    });
  });

  describe("Determinism", () => {
    it("should produce identical graphs on multiple runs", () => {
      const artifact = createMockArtifact({
        "route:POST:/api/users": {
          summary: "Handler with multiple nodes",
          nodes: [
            { kind: "middleware", label: "authMiddleware", file: "middleware.ts", line: 5 },
            { kind: "handler", label: "POST handler", file: "route.ts", line: 10 },
            { kind: "function", label: "validate", file: "route.ts", line: 15 },
            { kind: "sink", label: "prisma.create", file: "route.ts", line: 20 },
          ],
        },
      });

      const graph1 = buildTraceGraph(artifact, "route:POST:/api/users");
      const graph2 = buildTraceGraph(artifact, "route:POST:/api/users");

      expect(graph1).toEqual(graph2);
    });

    it("should produce stable node IDs", () => {
      const artifact = createMockArtifact({
        "route:POST:/api/users": {
          summary: "Handler",
          nodes: [
            { kind: "handler", label: "POST handler", file: "route.ts", line: 5 },
          ],
        },
      });

      const graph1 = buildTraceGraph(artifact, "route:POST:/api/users");
      const graph2 = buildTraceGraph(artifact, "route:POST:/api/users");

      const ids1 = graph1!.nodes.map((n) => n.id).sort();
      const ids2 = graph2!.nodes.map((n) => n.id).sort();

      expect(ids1).toEqual(ids2);
    });

    it("should produce stable edge IDs", () => {
      const artifact = createMockArtifact({
        "route:POST:/api/users": {
          summary: "Handler",
          nodes: [
            { kind: "handler", label: "POST handler", file: "route.ts", line: 5 },
            { kind: "sink", label: "prisma.create", file: "route.ts", line: 10 },
          ],
        },
      });

      const graph1 = buildTraceGraph(artifact, "route:POST:/api/users");
      const graph2 = buildTraceGraph(artifact, "route:POST:/api/users");

      const edgeIds1 = graph1!.edges.map((e) => e.id).sort();
      const edgeIds2 = graph2!.edges.map((e) => e.id).sort();

      expect(edgeIds1).toEqual(edgeIds2);
    });

    it("should produce deterministic positions", () => {
      const artifact = createMockArtifact({
        "route:POST:/api/users": {
          summary: "Handler with multiple nodes at same layer",
          nodes: [
            { kind: "function", label: "functionB", file: "route.ts", line: 5 },
            { kind: "function", label: "functionA", file: "route.ts", line: 10 },
            { kind: "function", label: "functionC", file: "route.ts", line: 15 },
          ],
        },
      });

      const graph1 = buildTraceGraph(artifact, "route:POST:/api/users");
      const graph2 = buildTraceGraph(artifact, "route:POST:/api/users");

      // Nodes should have same positions
      const positions1 = graph1!.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y }));
      const positions2 = graph2!.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y }));

      expect(positions1).toEqual(positions2);
    });
  });

  describe("Layout", () => {
    it("should assign correct layers based on node kind", () => {
      const artifact = createMockArtifact({
        "route:POST:/api/users": {
          summary: "Full trace",
          nodes: [
            { kind: "middleware", label: "auth", file: "middleware.ts", line: 5 },
            { kind: "handler", label: "POST", file: "route.ts", line: 10 },
            { kind: "function", label: "transform", file: "route.ts", line: 15 },
            { kind: "sink", label: "db.insert", file: "route.ts", line: 20 },
          ],
        },
      });

      const graph = buildTraceGraph(artifact, "route:POST:/api/users");

      const requestNode = graph!.nodes.find((n) => n.kind === "request");
      const middlewareNode = graph!.nodes.find((n) => n.kind === "middleware");
      const handlerNode = graph!.nodes.find((n) => n.kind === "handler");
      const functionNode = graph!.nodes.find((n) => n.kind === "function");
      const sinkNode = graph!.nodes.find((n) => n.kind === "sink");
      const responseNode = graph!.nodes.find((n) => n.kind === "response");

      expect(requestNode!.layer).toBe(0);
      expect(middlewareNode!.layer).toBe(1);
      expect(handlerNode!.layer).toBe(2);
      expect(functionNode!.layer).toBe(3);
      expect(sinkNode!.layer).toBe(4);
      expect(responseNode!.layer).toBe(5);
    });

    it("should space nodes vertically by layer", () => {
      const artifact = createMockArtifact({
        "route:POST:/api/users": {
          summary: "Handler",
          nodes: [
            { kind: "handler", label: "POST", file: "route.ts", line: 5 },
            { kind: "sink", label: "db", file: "route.ts", line: 10 },
          ],
        },
      });

      const graph = buildTraceGraph(artifact, "route:POST:/api/users");

      // Nodes in higher layers should have higher y values
      const sortedByLayer = [...graph!.nodes].sort((a, b) => a.layer - b.layer);
      for (let i = 1; i < sortedByLayer.length; i++) {
        expect(sortedByLayer[i].y).toBeGreaterThan(sortedByLayer[i - 1].y);
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty proof trace nodes array", () => {
      const artifact = createMockArtifact({
        "route:POST:/api/users": {
          summary: "Empty trace",
          nodes: [],
        },
      });

      const graph = buildTraceGraph(artifact, "route:POST:/api/users");

      // Should fall back to basic graph
      expect(graph).not.toBeNull();
      expect(graph!.nodes).toHaveLength(3); // request, handler, response
    });

    it("should handle missing file and line in proof nodes", () => {
      const artifact = createMockArtifact({
        "route:POST:/api/users": {
          summary: "Trace without file info",
          nodes: [{ kind: "handler", label: "handler" }],
        },
      });

      const graph = buildTraceGraph(artifact, "route:POST:/api/users");

      expect(graph).not.toBeNull();
      const handlerNode = graph!.nodes.find((n) => n.kind === "handler");
      expect(handlerNode!.file).toBeUndefined();
      expect(handlerNode!.line).toBeUndefined();
    });
  });
});
