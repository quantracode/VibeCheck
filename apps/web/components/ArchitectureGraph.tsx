"use client";

import { useRef, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ZoomIn, ZoomOut, Maximize2, Move } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type {
  ApplicationGraph,
  GraphNode,
  GraphEdge,
  NodeType,
  RiskLevel,
} from "@/lib/graph-builder";
import { applyForceLayout } from "@/lib/graph-builder";

// ============================================================================
// Constants
// ============================================================================

const NODE_COLORS: Record<NodeType, { fill: string; stroke: string }> = {
  route: { fill: "#3b82f6", stroke: "#1d4ed8" },
  file: { fill: "#6b7280", stroke: "#4b5563" },
  middleware: { fill: "#8b5cf6", stroke: "#6d28d9" },
  database: { fill: "#10b981", stroke: "#059669" },
  external: { fill: "#f59e0b", stroke: "#d97706" },
  config: { fill: "#ec4899", stroke: "#be185d" },
};

const RISK_COLORS: Record<RiskLevel, string> = {
  none: "#22c55e",
  low: "#3b82f6",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};

const NODE_ICONS: Record<NodeType, string> = {
  route: "M",
  file: "F",
  middleware: "MW",
  database: "DB",
  external: "EX",
  config: "C",
};

// ============================================================================
// Types
// ============================================================================

interface ArchitectureGraphProps {
  graph: ApplicationGraph;
  width?: number;
  height?: number;
  onNodeClick?: (node: GraphNode) => void;
  selectedNodeId?: string | null;
  highlightedNodeIds?: string[];
  className?: string;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  node: GraphNode | null;
}

// ============================================================================
// Component
// ============================================================================

export function ArchitectureGraph({
  graph: inputGraph,
  width = 900,
  height = 600,
  onNodeClick,
  selectedNodeId,
  highlightedNodeIds = [],
  className,
}: ArchitectureGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    node: null,
  });

  // Apply layout to graph
  const graph = useMemo(
    () => applyForceLayout(inputGraph, width, height, 150),
    [inputGraph, width, height]
  );

  // Reset view
  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z * 1.2, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z / 1.2, 0.3));
  }, []);

  // Pan handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        setIsDragging(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }
    },
    [pan]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        setPan({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.3, Math.min(3, z * delta)));
  }, []);

  // Node hover
  const handleNodeHover = useCallback(
    (node: GraphNode, e: React.MouseEvent) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
        setTooltip({
          visible: true,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          node,
        });
      }
    },
    []
  );

  const handleNodeLeave = useCallback(() => {
    setTooltip((t) => ({ ...t, visible: false }));
  }, []);

  // Render edge
  const renderEdge = (edge: GraphEdge) => {
    const source = graph.nodes.find((n) => n.id === edge.source);
    const target = graph.nodes.find((n) => n.id === edge.target);
    if (!source || !target) return null;

    const x1 = source.x ?? 0;
    const y1 = source.y ?? 0;
    const x2 = target.x ?? 0;
    const y2 = target.y ?? 0;

    // Calculate control point for curved edges
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const curveOffset = Math.min(30, Math.sqrt(dx * dx + dy * dy) * 0.1);

    const isHighlighted =
      highlightedNodeIds.includes(source.id) ||
      highlightedNodeIds.includes(target.id);

    return (
      <g key={edge.id}>
        <defs>
          <marker
            id={`arrow-${edge.id}`}
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path
              d="M0,0 L0,6 L6,3 z"
              fill={isHighlighted ? "#8b5cf6" : "#4b5563"}
            />
          </marker>
        </defs>
        <path
          d={`M ${x1} ${y1} Q ${midX + curveOffset} ${midY - curveOffset} ${x2} ${y2}`}
          fill="none"
          stroke={isHighlighted ? "#8b5cf6" : "#374151"}
          strokeWidth={isHighlighted ? 2 : 1}
          strokeOpacity={isHighlighted ? 1 : 0.5}
          markerEnd={`url(#arrow-${edge.id})`}
          className="transition-all duration-200"
        />
      </g>
    );
  };

  // Render node
  const renderNode = (node: GraphNode) => {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const colors = NODE_COLORS[node.type];
    const riskColor = RISK_COLORS[node.risk];
    const isSelected = selectedNodeId === node.id;
    const isHighlighted = highlightedNodeIds.includes(node.id);

    return (
      <g
        key={node.id}
        transform={`translate(${x}, ${y})`}
        onClick={() => onNodeClick?.(node)}
        onMouseEnter={(e) => handleNodeHover(node, e)}
        onMouseLeave={handleNodeLeave}
        className="cursor-pointer"
      >
        {/* Risk indicator ring */}
        {node.risk !== "none" && (
          <circle
            r={node.size + 4}
            fill="none"
            stroke={riskColor}
            strokeWidth={3}
            strokeOpacity={0.6}
            className="animate-pulse"
          />
        )}

        {/* Main node circle */}
        <circle
          r={node.size}
          fill={colors.fill}
          stroke={isSelected ? "#fff" : isHighlighted ? "#8b5cf6" : colors.stroke}
          strokeWidth={isSelected ? 3 : isHighlighted ? 2 : 1.5}
          className="transition-all duration-200"
        />

        {/* Node icon */}
        <text
          textAnchor="middle"
          dy="0.35em"
          fill="white"
          fontSize={node.size * 0.5}
          fontWeight="bold"
          className="pointer-events-none select-none"
        >
          {NODE_ICONS[node.type]}
        </text>

        {/* Finding count badge */}
        {node.findingCount > 0 && (
          <g transform={`translate(${node.size * 0.7}, ${-node.size * 0.7})`}>
            <circle r={10} fill={riskColor} />
            <text
              textAnchor="middle"
              dy="0.35em"
              fill="white"
              fontSize={9}
              fontWeight="bold"
              className="pointer-events-none select-none"
            >
              {node.findingCount}
            </text>
          </g>
        )}

        {/* Label */}
        <text
          y={node.size + 14}
          textAnchor="middle"
          fill="#9ca3af"
          fontSize={11}
          className="pointer-events-none select-none"
        >
          {node.label.length > 20
            ? node.label.slice(0, 18) + "..."
            : node.label}
        </text>
      </g>
    );
  };

  return (
    <div className={cn("relative bg-zinc-900 rounded-xl overflow-hidden", className)}>
      {/* Controls */}
      <div className="absolute top-3 right-3 z-10 flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleZoomIn}
          className="h-8 w-8 bg-zinc-800/80 hover:bg-zinc-700"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleZoomOut}
          className="h-8 w-8 bg-zinc-800/80 hover:bg-zinc-700"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={resetView}
          className="h-8 w-8 bg-zinc-800/80 hover:bg-zinc-700"
        >
          <Maximize2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Drag hint */}
      {zoom !== 1 && (
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 text-xs text-zinc-500">
          <Move className="w-3 h-3" />
          <span>Drag to pan</span>
        </div>
      )}

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className={cn(
          "transition-transform",
          isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Grid background */}
          <defs>
            <pattern
              id="grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="#27272a"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect
            x={-width}
            y={-height}
            width={width * 3}
            height={height * 3}
            fill="url(#grid)"
          />

          {/* Edges */}
          <g>{graph.edges.map(renderEdge)}</g>

          {/* Nodes */}
          <g>{graph.nodes.map(renderNode)}</g>
        </g>
      </svg>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltip.visible && tooltip.node && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute z-20 pointer-events-none"
            style={{
              left: tooltip.x + 15,
              top: tooltip.y + 15,
            }}
          >
            <NodeTooltip node={tooltip.node} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Node Tooltip
// ============================================================================

function NodeTooltip({ node }: { node: GraphNode }) {
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl p-3 max-w-xs">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: RISK_COLORS[node.risk] }}
        />
        <span className="font-medium text-sm text-zinc-100">{node.label}</span>
      </div>

      <div className="space-y-1 text-xs text-zinc-400">
        <div className="flex justify-between">
          <span>Type:</span>
          <span className="text-zinc-300 capitalize">{node.type}</span>
        </div>
        {node.file && (
          <div className="flex justify-between">
            <span>File:</span>
            <span className="text-zinc-300 font-mono truncate max-w-[150px]">
              {node.file}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Findings:</span>
          <span className="text-zinc-300">{node.findingCount}</span>
        </div>
        <div className="flex justify-between">
          <span>Risk:</span>
          <span
            className="capitalize font-medium"
            style={{ color: RISK_COLORS[node.risk] }}
          >
            {node.risk}
          </span>
        </div>
      </div>

      {/* Protection status */}
      <div className="mt-2 pt-2 border-t border-zinc-700 flex flex-wrap gap-1">
        {node.hasAuth && (
          <span className="px-1.5 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-400 rounded">
            Auth
          </span>
        )}
        {node.middlewareCovered && (
          <span className="px-1.5 py-0.5 text-[10px] bg-purple-500/20 text-purple-400 rounded">
            Middleware
          </span>
        )}
        {node.hasValidation && (
          <span className="px-1.5 py-0.5 text-[10px] bg-blue-500/20 text-blue-400 rounded">
            Validated
          </span>
        )}
        {node.hasRateLimit && (
          <span className="px-1.5 py-0.5 text-[10px] bg-yellow-500/20 text-yellow-400 rounded">
            Rate Limited
          </span>
        )}
        {!node.hasAuth &&
          !node.middlewareCovered &&
          !node.hasValidation &&
          !node.hasRateLimit &&
          node.type === "route" && (
            <span className="px-1.5 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded">
              Unprotected
            </span>
          )}
      </div>

      <p className="mt-2 text-[10px] text-zinc-500">Click to view findings</p>
    </div>
  );
}

// ============================================================================
// Legend
// ============================================================================

export function GraphLegend({ className, horizontal = false }: { className?: string; horizontal?: boolean }) {
  if (horizontal) {
    return (
      <div className={cn("flex flex-wrap items-center justify-between gap-6", className)}>
        <div className="flex items-center gap-6">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Node Types
          </span>
          <div className="flex flex-wrap items-center gap-4">
            {Object.entries(NODE_COLORS).map(([type, colors]) => (
              <div key={type} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: colors.fill }}
                />
                <span className="text-xs text-muted-foreground capitalize">{type}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Risk Levels
          </span>
          <div className="flex flex-wrap items-center gap-4">
            {Object.entries(RISK_COLORS).map(([level, color]) => (
              <div key={level} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-muted-foreground capitalize">{level}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Node Types
        </p>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(NODE_COLORS).map(([type, colors]) => (
            <div key={type} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: colors.fill }}
              />
              <span className="text-xs text-muted-foreground capitalize">{type}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Risk Levels
        </p>
        <div className="space-y-1">
          {Object.entries(RISK_COLORS).map(([level, color]) => (
            <div key={level} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-muted-foreground capitalize">{level}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
