"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ShieldOff,
  HelpCircle,
  FileCode,
  ExternalLink,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type {
  HeatmapData,
  RouteProtectionRow,
  ProtectionCell,
  ProtectionStatus,
} from "@/lib/heatmap-builder";

// ============================================================================
// Constants
// ============================================================================

const STATUS_COLORS: Record<ProtectionStatus, { bg: string; text: string; border: string }> = {
  protected: {
    bg: "bg-emerald-500/20",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
  },
  missing: {
    bg: "bg-red-500/20",
    text: "text-red-400",
    border: "border-red-500/30",
  },
  unknown: {
    bg: "bg-zinc-500/20",
    text: "text-zinc-400",
    border: "border-zinc-500/30",
  },
};

const STATUS_ICONS: Record<ProtectionStatus, typeof Shield> = {
  protected: Shield,
  missing: ShieldOff,
  unknown: HelpCircle,
};

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  POST: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  PUT: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  PATCH: "bg-orange-500/10 text-orange-500 border-orange-500/30",
  DELETE: "bg-red-500/10 text-red-500 border-red-500/30",
};

// ============================================================================
// Types
// ============================================================================

interface RouteHeatmapProps {
  data: HeatmapData;
  onRouteClick?: (routeId: string) => void;
  className?: string;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  cell: ProtectionCell | null;
  column: string;
}

// ============================================================================
// Component
// ============================================================================

export function RouteHeatmap({
  data,
  onRouteClick,
  className,
}: RouteHeatmapProps) {
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    cell: null,
    column: "",
  });

  const handleCellHover = useCallback(
    (cell: ProtectionCell, column: string, e: React.MouseEvent) => {
      setTooltip({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        cell,
        column,
      });
    },
    []
  );

  const handleCellLeave = useCallback(() => {
    setTooltip((t) => ({ ...t, visible: false }));
  }, []);

  const toggleRoute = useCallback((routeId: string) => {
    setExpandedRoute((prev) => (prev === routeId ? null : routeId));
  }, []);

  if (data.routes.length === 0) {
    return (
      <div className={cn("p-8 text-center text-muted-foreground", className)}>
        No routes to display
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-x-auto", className)}>
      {/* Table */}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="py-3 px-4 text-left font-medium text-muted-foreground sticky left-0 bg-background z-10">
              Route
            </th>
            {data.columns.map((col) => (
              <th
                key={col.key}
                className="py-3 px-4 text-center font-medium text-muted-foreground min-w-[80px]"
                title={col.description}
              >
                {col.label}
              </th>
            ))}
            <th className="py-3 px-4 text-center font-medium text-muted-foreground min-w-[80px]">
              Findings
            </th>
          </tr>
        </thead>
        <tbody>
          {data.routes.map((route, idx) => (
            <RouteRow
              key={route.routeId}
              route={route}
              columns={data.columns}
              isExpanded={expandedRoute === route.routeId}
              onToggle={() => toggleRoute(route.routeId)}
              onRouteClick={onRouteClick}
              onCellHover={handleCellHover}
              onCellLeave={handleCellLeave}
              delay={idx * 0.02}
            />
          ))}
        </tbody>
      </table>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltip.visible && tooltip.cell && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="fixed z-50 pointer-events-none"
            style={{
              left: tooltip.x + 10,
              top: tooltip.y + 10,
            }}
          >
            <CellTooltip cell={tooltip.cell} column={tooltip.column} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 px-4 py-3 bg-muted/30 rounded-lg">
        <span className="text-xs font-medium text-muted-foreground">Legend:</span>
        {Object.entries(STATUS_COLORS).map(([status, colors]) => {
          const Icon = STATUS_ICONS[status as ProtectionStatus];
          return (
            <div key={status} className="flex items-center gap-2">
              <div className={cn("w-5 h-5 rounded flex items-center justify-center", colors.bg)}>
                <Icon className={cn("w-3 h-3", colors.text)} />
              </div>
              <span className="text-xs text-muted-foreground capitalize">{status}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Row Component
// ============================================================================

function RouteRow({
  route,
  columns,
  isExpanded,
  onToggle,
  onRouteClick,
  onCellHover,
  onCellLeave,
  delay,
}: {
  route: RouteProtectionRow;
  columns: HeatmapData["columns"];
  isExpanded: boolean;
  onToggle: () => void;
  onRouteClick?: (routeId: string) => void;
  onCellHover: (cell: ProtectionCell, column: string, e: React.MouseEvent) => void;
  onCellLeave: () => void;
  delay: number;
}) {
  const methodColor = METHOD_COLORS[route.method] ?? METHOD_COLORS.GET;

  return (
    <>
      <motion.tr
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, delay }}
        className={cn(
          "border-b border-border/50 hover:bg-muted/30 transition-colors",
          route.hasGaps && "bg-red-500/5",
          route.isStateChanging && "font-medium"
        )}
      >
        {/* Route info */}
        <td className="py-3 px-4 sticky left-0 bg-background z-10">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggle}
              className="p-0.5 hover:bg-muted rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
            <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold border", methodColor)}>
              {route.method}
            </span>
            <button
              onClick={() => onRouteClick?.(route.routeId)}
              className="font-mono text-sm hover:text-primary transition-colors flex items-center gap-1 group"
            >
              {route.path}
              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            {route.hasGaps && (
              <span title="Route has security gaps">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </span>
            )}
          </div>
        </td>

        {/* Protection cells */}
        {columns.map((col) => {
          const cell = route.protections[col.key];
          const colors = STATUS_COLORS[cell.status];
          const Icon = STATUS_ICONS[cell.status];

          return (
            <td key={col.key} className="py-3 px-4 text-center">
              <div
                className={cn(
                  "inline-flex items-center justify-center w-8 h-8 rounded-lg cursor-help transition-transform hover:scale-110",
                  colors.bg,
                  colors.border,
                  "border"
                )}
                onMouseEnter={(e) => onCellHover(cell, col.label, e)}
                onMouseLeave={onCellLeave}
              >
                <Icon className={cn("w-4 h-4", colors.text)} />
              </div>
            </td>
          );
        })}

        {/* Finding count */}
        <td className="py-3 px-4 text-center">
          {route.findingCount > 0 ? (
            <Link
              href={`/findings?file=${encodeURIComponent(route.file)}`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-medium hover:bg-amber-500/20 transition-colors"
            >
              <AlertTriangle className="w-3 h-3" />
              {route.findingCount}
            </Link>
          ) : (
            <span className="text-muted-foreground text-xs">0</span>
          )}
        </td>
      </motion.tr>

      {/* Expanded details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.tr
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <td colSpan={columns.length + 2} className="bg-muted/20 border-b border-border">
              <div className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                  <FileCode className="w-3 h-3" />
                  <span className="font-mono">
                    {route.file}
                    {route.line && `:${route.line}`}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {columns.map((col) => {
                    const cell = route.protections[col.key];
                    const colors = STATUS_COLORS[cell.status];
                    return (
                      <div
                        key={col.key}
                        className={cn("p-3 rounded-lg", colors.bg, "border", colors.border)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn("text-xs font-medium", colors.text)}>
                            {col.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {cell.tooltip}
                        </p>
                        {cell.evidence?.findingId && (
                          <Link
                            href={`/findings#${cell.evidence.findingId}`}
                            className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
                          >
                            View finding
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
}

// ============================================================================
// Tooltip Component
// ============================================================================

function CellTooltip({ cell, column }: { cell: ProtectionCell; column: string }) {
  const colors = STATUS_COLORS[cell.status];

  return (
    <div className="bg-popover border border-border rounded-lg shadow-xl p-3 max-w-xs">
      <div className="flex items-center gap-2 mb-2">
        <span className={cn("text-xs font-medium capitalize", colors.text)}>
          {cell.status}
        </span>
        <span className="text-xs text-muted-foreground">- {column}</span>
      </div>
      <p className="text-sm text-foreground mb-2">{cell.tooltip}</p>
      {cell.evidence?.file && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <FileCode className="w-3 h-3" />
          <span className="font-mono">
            {cell.evidence.file}
            {cell.evidence.line && `:${cell.evidence.line}`}
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Summary Component
// ============================================================================

export function HeatmapSummary({ data }: { data: HeatmapData }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {data.columns.map((col) => {
        const counts = data.summary.protectionCounts[col.key];
        const total = counts.protected + counts.missing + counts.unknown;
        const percentage = total > 0 ? Math.round((counts.protected / total) * 100) : 100;

        return (
          <div
            key={col.key}
            className="p-4 rounded-lg bg-card border border-border"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{col.label}</span>
              <span
                className={cn(
                  "text-lg font-bold",
                  percentage >= 80 && "text-emerald-500",
                  percentage >= 50 && percentage < 80 && "text-yellow-500",
                  percentage < 50 && "text-red-500"
                )}
              >
                {percentage}%
              </span>
            </div>
            <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-muted">
              {counts.protected > 0 && (
                <div
                  className="bg-emerald-500 transition-all"
                  style={{ width: `${(counts.protected / total) * 100}%` }}
                />
              )}
              {counts.missing > 0 && (
                <div
                  className="bg-red-500 transition-all"
                  style={{ width: `${(counts.missing / total) * 100}%` }}
                />
              )}
              {counts.unknown > 0 && (
                <div
                  className="bg-zinc-500 transition-all"
                  style={{ width: `${(counts.unknown / total) * 100}%` }}
                />
              )}
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span className="text-emerald-500">{counts.protected} ok</span>
              <span className="text-red-500">{counts.missing} gaps</span>
              <span className="text-zinc-500">{counts.unknown} ?</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
