"use client";

import { useRef, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ZoomIn, ZoomOut, Maximize2, Move, FileCode, AlertTriangle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type {
  TraceGraph,
  TraceGraphNode,
  TraceGraphEdge,
  TraceNodeKind,
} from "@/lib/trace-graph-builder";
import { getGraphDimensions } from "@/lib/trace-graph-builder";

// ============================================================================
// Constants
// ============================================================================

const NODE_COLORS: Record<TraceNodeKind, { fill: string; stroke: string; text: string }> = {
  request: { fill: "#3b82f6", stroke: "#1d4ed8", text: "REQ" },
  middleware: { fill: "#8b5cf6", stroke: "#6d28d9", text: "MW" },
  handler: { fill: "#10b981", stroke: "#059669", text: "H" },
  function: { fill: "#f59e0b", stroke: "#d97706", text: "FN" },
  validator: { fill: "#06b6d4", stroke: "#0891b2", text: "VAL" },
  sink: { fill: "#ef4444", stroke: "#dc2626", text: "SINK" },
  response: { fill: "#22c55e", stroke: "#16a34a", text: "RES" },
};

const NODE_SIZE = 28;
const LABEL_OFFSET = 45;

// ============================================================================
// Types
// ============================================================================

interface TraceGraphProps {
  graph: TraceGraph;
  onNodeClick?: (node: TraceGraphNode) => void;
  selectedNodeId?: string | null;
  highlightedNodeIds?: string[];
  className?: string;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  node: TraceGraphNode | null;
}

// ============================================================================
// Component
// ============================================================================

export function TraceGraphView({
  graph,
  onNodeClick,
  selectedNodeId,
  highlightedNodeIds = [],
  className,
}: TraceGraphProps) {
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

  // Calculate dimensions
  const { width, height } = useMemo(() => getGraphDimensions(graph), [graph]);

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
    (node: TraceGraphNode, e: React.MouseEvent) => {
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
  const renderEdge = useCallback((edge: TraceGraphEdge) => {
    const source = graph.nodes.find((n) => n.id === edge.source);
    const target = graph.nodes.find((n) => n.id === edge.target);
    if (!source || !target) return null;

    const x1 = source.x;
    const y1 = source.y;
    const x2 = target.x;
    const y2 = target.y;

    // Check if source and target are highlighted
    const isHighlighted =
      highlightedNodeIds.includes(source.id) ||
      highlightedNodeIds.includes(target.id);

    // Straight line with arrow (vertical flow)
    return (
      <g key={edge.id}>
        <defs>
          <marker
            id={`arrow-${edge.id}`}
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="4"
            orient="auto"
          >
            <path
              d="M0,0 L0,8 L8,4 z"
              fill={isHighlighted ? "#8b5cf6" : "#6b7280"}
            />
          </marker>
        </defs>
        <line
          x1={x1}
          y1={y1 + NODE_SIZE}
          x2={x2}
          y2={y2 - NODE_SIZE - 8}
          stroke={isHighlighted ? "#8b5cf6" : "#4b5563"}
          strokeWidth={isHighlighted ? 2 : 1.5}
          strokeOpacity={isHighlighted ? 1 : 0.6}
          markerEnd={`url(#arrow-${edge.id})`}
          className="transition-all duration-200"
        />
        {edge.label && (
          <text
            x={(x1 + x2) / 2 + 10}
            y={(y1 + y2) / 2}
            fill="#9ca3af"
            fontSize={10}
            className="pointer-events-none select-none"
          >
            {edge.label}
          </text>
        )}
      </g>
    );
  }, [graph.nodes, highlightedNodeIds]);

  // Render node
  const renderNode = useCallback((node: TraceGraphNode) => {
    const x = node.x;
    const y = node.y;
    const colors = NODE_COLORS[node.kind];
    const isSelected = selectedNodeId === node.id;
    const isHighlighted = highlightedNodeIds.includes(node.id);
    const hasFindings = node.findingIds.length > 0;

    return (
      <g
        key={node.id}
        transform={`translate(${x}, ${y})`}
        onClick={() => onNodeClick?.(node)}
        onMouseEnter={(e) => handleNodeHover(node, e)}
        onMouseLeave={handleNodeLeave}
        className="cursor-pointer"
      >
        {/* Finding indicator ring */}
        {hasFindings && (
          <circle
            r={NODE_SIZE + 4}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={3}
            strokeOpacity={0.6}
            className="animate-pulse"
          />
        )}

        {/* Main node circle */}
        <circle
          r={NODE_SIZE}
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
          fontSize={NODE_SIZE * 0.4}
          fontWeight="bold"
          className="pointer-events-none select-none"
        >
          {colors.text}
        </text>

        {/* Finding count badge */}
        {hasFindings && (
          <g transform={`translate(${NODE_SIZE * 0.7}, ${-NODE_SIZE * 0.7})`}>
            <circle r={10} fill="#f59e0b" />
            <text
              textAnchor="middle"
              dy="0.35em"
              fill="white"
              fontSize={9}
              fontWeight="bold"
              className="pointer-events-none select-none"
            >
              {node.findingIds.length}
            </text>
          </g>
        )}

        {/* Label */}
        <text
          y={LABEL_OFFSET}
          textAnchor="middle"
          fill="#d4d4d8"
          fontSize={11}
          className="pointer-events-none select-none"
        >
          {node.label.length > 25
            ? node.label.slice(0, 23) + "..."
            : node.label}
        </text>
      </g>
    );
  }, [selectedNodeId, highlightedNodeIds, onNodeClick, handleNodeHover, handleNodeLeave]);

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

      {/* Route label */}
      <div className="absolute top-3 left-3 z-10">
        <span className="px-3 py-1.5 rounded-lg bg-zinc-800/80 text-sm font-mono text-zinc-200">
          {graph.routeLabel}
        </span>
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
        width="100%"
        height={Math.max(400, height * zoom)}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className={cn(
          "transition-transform min-h-[400px]",
          isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Grid background */}
          <defs>
            <pattern
              id="trace-grid"
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
            fill="url(#trace-grid)"
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

function NodeTooltip({ node }: { node: TraceGraphNode }) {
  const colors = NODE_COLORS[node.kind];
  const hasFindings = node.findingIds.length > 0;

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl p-3 max-w-xs">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: colors.fill }}
        />
        <span className="font-medium text-sm text-zinc-100">{node.label}</span>
      </div>

      <div className="space-y-1 text-xs text-zinc-400">
        <div className="flex justify-between">
          <span>Type:</span>
          <span className="text-zinc-300 capitalize">{node.kind}</span>
        </div>
        {node.file && (
          <div className="flex items-center gap-1">
            <FileCode className="w-3 h-3" />
            <span className="text-zinc-300 font-mono truncate max-w-[200px]">
              {node.file}{node.line ? `:${node.line}` : ""}
            </span>
          </div>
        )}
        {hasFindings && (
          <div className="flex items-center gap-1 text-amber-400">
            <AlertTriangle className="w-3 h-3" />
            <span>{node.findingIds.length} finding{node.findingIds.length !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      <p className="mt-2 text-[10px] text-zinc-500 flex items-center gap-1">
        <ExternalLink className="w-3 h-3" />
        Click to view details
      </p>
    </div>
  );
}

// ============================================================================
// Legend
// ============================================================================

export function TraceGraphLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-4 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800", className)}>
      <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
        Node Types
      </span>
      {Object.entries(NODE_COLORS).map(([kind, colors]) => (
        <div key={kind} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: colors.fill }}
          />
          <span className="text-xs text-zinc-400 capitalize">{kind}</span>
        </div>
      ))}
    </div>
  );
}
