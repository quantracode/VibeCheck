"use client";

import { useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { CoverageRadarData } from "@/lib/heatmap-builder";

// ============================================================================
// Types
// ============================================================================

interface CoverageRadarProps {
  data: CoverageRadarData;
  size?: number;
  className?: string;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  axis: CoverageRadarData["axes"][0] | null;
}

// ============================================================================
// Constants
// ============================================================================

const RINGS = [100, 80, 60, 40, 20];
const LABEL_OFFSET = 30;

// ============================================================================
// Helpers
// ============================================================================

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
): { x: number; y: number } {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function getColor(value: number): string {
  if (value >= 80) return "#22c55e"; // green
  if (value >= 60) return "#eab308"; // yellow
  if (value >= 40) return "#f97316"; // orange
  return "#ef4444"; // red
}

// ============================================================================
// Component
// ============================================================================

export function CoverageRadar({
  data,
  size = 400,
  className,
}: CoverageRadarProps) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    axis: null,
  });

  const center = size / 2;
  const maxRadius = (size - LABEL_OFFSET * 2) / 2;

  // Calculate polygon points for the data
  const { points, polygonPath, labelPoints } = useMemo(() => {
    const numAxes = data.axes.length;
    const angleStep = 360 / numAxes;
    const pts: Array<{ x: number; y: number; value: number; axis: CoverageRadarData["axes"][0] }> = [];
    const lblPts: Array<{ x: number; y: number; axis: CoverageRadarData["axes"][0] }> = [];

    data.axes.forEach((axis, i) => {
      const angle = i * angleStep;
      const radius = (axis.value / 100) * maxRadius;
      const point = polarToCartesian(center, center, radius, angle);
      const labelPoint = polarToCartesian(center, center, maxRadius + 25, angle);

      pts.push({ ...point, value: axis.value, axis });
      lblPts.push({ ...labelPoint, axis });
    });

    const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

    return { points: pts, polygonPath: path, labelPoints: lblPts };
  }, [data.axes, center, maxRadius]);

  // Calculate ring paths
  const ringPaths = useMemo(() => {
    const numAxes = data.axes.length;
    const angleStep = 360 / numAxes;

    return RINGS.map((ringValue) => {
      const radius = (ringValue / 100) * maxRadius;
      const ringPoints = data.axes.map((_, i) => {
        const angle = i * angleStep;
        return polarToCartesian(center, center, radius, angle);
      });
      return ringPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
    });
  }, [data.axes.length, center, maxRadius]);

  // Axis lines
  const axisLines = useMemo(() => {
    const numAxes = data.axes.length;
    const angleStep = 360 / numAxes;

    return data.axes.map((_, i) => {
      const angle = i * angleStep;
      const end = polarToCartesian(center, center, maxRadius, angle);
      return { x1: center, y1: center, x2: end.x, y2: end.y };
    });
  }, [data.axes.length, center, maxRadius]);

  // Handle axis hover
  const handleAxisHover = useCallback(
    (axis: CoverageRadarData["axes"][0], e: React.MouseEvent) => {
      setTooltip({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        axis,
      });
    },
    []
  );

  const handleAxisLeave = useCallback(() => {
    setTooltip((t) => ({ ...t, visible: false }));
  }, []);

  // Overall score
  const overallScore = useMemo(() => {
    const sum = data.axes.reduce((acc, axis) => acc + axis.value, 0);
    return Math.round(sum / data.axes.length);
  }, [data.axes]);

  return (
    <div className={cn("relative", className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
      >
        {/* Background rings */}
        {ringPaths.map((path, i) => (
          <path
            key={i}
            d={path}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            className="text-border"
            strokeOpacity={0.5}
          />
        ))}

        {/* Ring labels */}
        {RINGS.map((value) => {
          const radius = (value / 100) * maxRadius;
          return (
            <text
              key={value}
              x={center}
              y={center - radius - 4}
              textAnchor="middle"
              fontSize={10}
              className="fill-muted-foreground"
            >
              {value}%
            </text>
          );
        })}

        {/* Axis lines */}
        {axisLines.map((line, i) => (
          <line
            key={i}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="currentColor"
            strokeWidth={1}
            className="text-border"
            strokeOpacity={0.5}
          />
        ))}

        {/* Data polygon - gradient fill */}
        <defs>
          <linearGradient id="radar-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.3} />
          </linearGradient>
        </defs>
        <motion.path
          d={polygonPath}
          fill="url(#radar-gradient)"
          stroke="#22c55e"
          strokeWidth={2}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />

        {/* Data points */}
        {points.map((point, i) => (
          <motion.circle
            key={i}
            cx={point.x}
            cy={point.y}
            r={6}
            fill={getColor(point.value)}
            stroke="white"
            strokeWidth={2}
            className="cursor-pointer"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            onMouseEnter={(e) => handleAxisHover(point.axis, e)}
            onMouseLeave={handleAxisLeave}
          />
        ))}

        {/* Axis labels */}
        {labelPoints.map((point, i) => (
          <text
            key={i}
            x={point.x}
            y={point.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={12}
            fontWeight={500}
            className="fill-foreground cursor-pointer"
            onMouseEnter={(e) => handleAxisHover(point.axis, e)}
            onMouseLeave={handleAxisLeave}
          >
            {point.axis.label}
          </text>
        ))}

        {/* Center score */}
        <circle
          cx={center}
          cy={center}
          r={35}
          fill="currentColor"
          className="text-background"
          stroke="currentColor"
          strokeWidth={2}
          style={{ stroke: getColor(overallScore) }}
        />
        <text
          x={center}
          y={center - 5}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={20}
          fontWeight={700}
          className="fill-foreground"
        >
          {overallScore}%
        </text>
        <text
          x={center}
          y={center + 12}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={10}
          className="fill-muted-foreground"
        >
          overall
        </text>
      </svg>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltip.visible && tooltip.axis && (
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
            <AxisTooltip axis={tooltip.axis} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Tooltip Component
// ============================================================================

function AxisTooltip({ axis }: { axis: CoverageRadarData["axes"][0] }) {
  const color = getColor(axis.value);

  return (
    <div className="bg-popover border border-border rounded-lg shadow-xl p-3 min-w-[160px]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{axis.label}</span>
        <span
          className="text-lg font-bold"
          style={{ color }}
        >
          {axis.value}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden mb-2">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${axis.value}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <div className="text-xs text-muted-foreground">
        {axis.count} of {axis.total} protected
      </div>
    </div>
  );
}

// ============================================================================
// Compact Legend
// ============================================================================

export function CoverageRadarLegend({
  data,
  className,
}: {
  data: CoverageRadarData;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-3 gap-3", className)}>
      {data.axes.map((axis) => {
        const color = getColor(axis.value);
        return (
          <div
            key={axis.key}
            className="flex items-center justify-between p-3 rounded-lg bg-card border border-border"
          >
            <span className="text-sm text-muted-foreground">{axis.label}</span>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm font-medium" style={{ color }}>
                {axis.value}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
