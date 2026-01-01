"use client";

import { cn } from "@/lib/utils";
import type { ProofTrace, ProofNode } from "@vibecheck/schema";
import {
  Route,
  Shield,
  Code,
  FunctionSquare,
  Database,
  Settings,
  Circle,
} from "lucide-react";

interface ProofTraceTimelineProps {
  proof: ProofTrace;
  className?: string;
}

const nodeIcons: Record<string, React.ElementType> = {
  route: Route,
  middleware: Shield,
  handler: Code,
  function: FunctionSquare,
  sink: Database,
  config: Settings,
  other: Circle,
};

const nodeColors: Record<string, string> = {
  route: "text-blue-500 bg-blue-500/10 border-blue-500/30",
  middleware: "text-purple-500 bg-purple-500/10 border-purple-500/30",
  handler: "text-green-500 bg-green-500/10 border-green-500/30",
  function: "text-orange-500 bg-orange-500/10 border-orange-500/30",
  sink: "text-red-500 bg-red-500/10 border-red-500/30",
  config: "text-cyan-500 bg-cyan-500/10 border-cyan-500/30",
  other: "text-gray-500 bg-gray-500/10 border-gray-500/30",
};

function ProofNodeItem({ node, isLast }: { node: ProofNode; isLast: boolean }) {
  const Icon = nodeIcons[node.kind] ?? Circle;
  const colorClass = nodeColors[node.kind] ?? nodeColors.other;

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "w-8 h-8 rounded-full border flex items-center justify-center",
            colorClass
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
        {!isLast && (
          <div className="w-0.5 flex-1 bg-border mt-2" />
        )}
      </div>

      <div className="pb-6 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            {node.kind}
          </span>
        </div>
        <p className="text-sm font-medium mt-1">{node.label}</p>
        {node.file && (
          <p className="text-xs text-muted-foreground font-mono mt-1">
            {node.file}
            {node.line && `:${node.line}`}
          </p>
        )}
      </div>
    </div>
  );
}

export function ProofTraceTimeline({
  proof,
  className,
}: ProofTraceTimelineProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <p className="text-sm text-muted-foreground">{proof.summary}</p>

      <div className="pl-2">
        {proof.nodes.map((node, index) => (
          <ProofNodeItem
            key={index}
            node={node}
            isLast={index === proof.nodes.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
