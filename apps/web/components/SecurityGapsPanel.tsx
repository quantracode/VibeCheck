"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  Shield,
  ShieldOff,
  Clock,
  FileQuestion,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SecurityGap, ApplicationGraph } from "@/lib/graph-builder";
import { analyzeSecurityGaps } from "@/lib/graph-builder";
import type { Severity } from "@vibecheck/schema";

// ============================================================================
// Types
// ============================================================================

interface SecurityGapsPanelProps {
  graph: ApplicationGraph;
  onGapClick?: (gap: SecurityGap) => void;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/30",
  high: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  low: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  info: "text-zinc-400 bg-zinc-500/10 border-zinc-500/30",
};

const SEVERITY_ICONS: Record<Severity, typeof AlertTriangle> = {
  critical: ShieldOff,
  high: AlertTriangle,
  medium: Clock,
  low: FileQuestion,
  info: Shield,
};

// ============================================================================
// Component
// ============================================================================

export function SecurityGapsPanel({
  graph,
  onGapClick,
  className,
}: SecurityGapsPanelProps) {
  const gaps = analyzeSecurityGaps(graph);

  // Group gaps by severity
  const criticalGaps = gaps.filter((g) => g.severity === "critical");
  const highGaps = gaps.filter((g) => g.severity === "high");
  const otherGaps = gaps.filter(
    (g) => g.severity !== "critical" && g.severity !== "high"
  );

  const totalGaps = gaps.length;
  const criticalCount = criticalGaps.length;
  const highCount = highGaps.length;

  if (gaps.length === 0) {
    return (
      <Card className={cn("border-emerald-500/30 bg-emerald-500/5", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            Security Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/10">
            <Shield className="w-8 h-8 text-emerald-400" />
            <div>
              <p className="font-medium text-emerald-400">No Gaps Detected</p>
              <p className="text-sm text-zinc-400">
                Architecture follows security best practices
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        criticalCount > 0
          ? "border-red-500/30 bg-red-500/5"
          : highCount > 0
            ? "border-orange-500/30 bg-orange-500/5"
            : "border-yellow-500/30 bg-yellow-500/5",
        className
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle
            className={cn(
              "w-5 h-5",
              criticalCount > 0
                ? "text-red-400"
                : highCount > 0
                  ? "text-orange-400"
                  : "text-yellow-400"
            )}
          />
          Security Gaps
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            {totalGaps} issue{totalGaps !== 1 ? "s" : ""}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-2">
          <SummaryStat
            label="Critical"
            count={criticalCount}
            color="text-red-400"
          />
          <SummaryStat label="High" count={highCount} color="text-orange-400" />
          <SummaryStat
            label="Medium"
            count={otherGaps.length}
            color="text-yellow-400"
          />
        </div>

        {/* Gap List */}
        <div className="space-y-2">
          {[...criticalGaps, ...highGaps, ...otherGaps].map((gap, index) => (
            <GapCard
              key={gap.id}
              gap={gap}
              index={index}
              onClick={() => onGapClick?.(gap)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function SummaryStat({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div
      className={cn(
        "text-center py-2 rounded-lg",
        count > 0 ? "bg-zinc-800/50" : "bg-zinc-900/50"
      )}
    >
      <p className={cn("text-lg font-bold", count > 0 ? color : "text-zinc-600")}>
        {count}
      </p>
      <p className="text-[10px] text-zinc-500 uppercase tracking-wide">{label}</p>
    </div>
  );
}

function GapCard({
  gap,
  index,
  onClick,
}: {
  gap: SecurityGap;
  index: number;
  onClick?: () => void;
}) {
  const Icon = SEVERITY_ICONS[gap.severity];
  const colorClass = SEVERITY_COLORS[gap.severity];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <button
        onClick={onClick}
        className={cn(
          "w-full text-left p-3 rounded-lg border transition-colors group",
          colorClass,
          "hover:bg-zinc-800/50"
        )}
      >
        <div className="flex items-start gap-3">
          <Icon className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-sm">{gap.title}</p>
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
            <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">
              {gap.description}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-zinc-500">
                {gap.affectedNodes.length} affected node
                {gap.affectedNodes.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      </button>
    </motion.div>
  );
}

// ============================================================================
// Gap Detail Modal
// ============================================================================

interface GapDetailProps {
  gap: SecurityGap;
  onHighlightNodes?: (nodeIds: string[]) => void;
  className?: string;
}

export function GapDetail({ gap, onHighlightNodes, className }: GapDetailProps) {
  const Icon = SEVERITY_ICONS[gap.severity];
  const colorClass = SEVERITY_COLORS[gap.severity];

  return (
    <div className={cn("space-y-4", className)}>
      <div className={cn("p-4 rounded-lg border", colorClass)}>
        <div className="flex items-start gap-3">
          <Icon className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold">{gap.title}</h3>
            <p className="text-sm text-zinc-400 mt-1">{gap.description}</p>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
          Recommendation
        </p>
        <p className="text-sm text-zinc-300">{gap.recommendation}</p>
      </div>

      <div>
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
          Affected Components ({gap.affectedNodes.length})
        </p>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {gap.affectedNodes.slice(0, 10).map((nodeId) => (
            <div
              key={nodeId}
              className="text-xs font-mono text-zinc-400 bg-zinc-800/50 rounded px-2 py-1 truncate"
            >
              {nodeId}
            </div>
          ))}
          {gap.affectedNodes.length > 10 && (
            <p className="text-xs text-zinc-500">
              +{gap.affectedNodes.length - 10} more
            </p>
          )}
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onHighlightNodes?.(gap.affectedNodes)}
        className="w-full"
      >
        Highlight in Graph
      </Button>
    </div>
  );
}
