"use client";

import { motion } from "framer-motion";
import {
  Shield,
  Database,
  Globe,
  FileCode,
  Lock,
  CheckCircle2,
  ArrowRight,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BestPracticeNode } from "@/lib/graph-builder";
import { BEST_PRACTICE_ARCHITECTURE } from "@/lib/graph-builder";

// ============================================================================
// Types
// ============================================================================

interface BestPracticePanelProps {
  className?: string;
}

// ============================================================================
// Icons
// ============================================================================

const nodeIcons: Record<string, typeof Shield> = {
  external: Globe,
  middleware: Shield,
  route: FileCode,
  file: Layers,
  database: Database,
  config: Lock,
};

// ============================================================================
// Component
// ============================================================================

export function BestPracticePanel({ className }: BestPracticePanelProps) {
  const architecture = BEST_PRACTICE_ARCHITECTURE;

  return (
    <Card className={cn("border-emerald-500/30 bg-emerald-500/5", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          Best Practice Architecture
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {architecture.description}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Visual Flow */}
        <div className="relative">
          {architecture.nodes.map((node, index) => (
            <BestPracticeNodeRow
              key={node.id}
              node={node}
              isLast={index === architecture.nodes.length - 1}
              edge={architecture.edges.find((e) => e.source === node.id)}
            />
          ))}
        </div>

        {/* Key Principles */}
        <div className="pt-3 border-t border-zinc-800">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">
            Security Principles
          </p>
          <div className="space-y-2">
            <Principle
              title="Defense in Depth"
              description="Multiple layers of protection at each level"
            />
            <Principle
              title="Fail Secure"
              description="Default to deny when errors occur"
            />
            <Principle
              title="Least Privilege"
              description="Only expose necessary data and actions"
            />
            <Principle
              title="Input Validation"
              description="Validate all input at the boundary"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function BestPracticeNodeRow({
  node,
  isLast,
  edge,
}: {
  node: BestPracticeNode;
  isLast: boolean;
  edge?: { label: string };
}) {
  const Icon = nodeIcons[node.type] ?? FileCode;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="relative"
    >
      <div className="flex items-start gap-3 py-2">
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
            node.required
              ? "bg-emerald-500/20 border border-emerald-500/30"
              : "bg-zinc-800/50 border border-zinc-700/50"
          )}
        >
          <Icon
            className={cn(
              "w-5 h-5",
              node.required ? "text-emerald-400" : "text-zinc-500"
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm text-zinc-200">{node.label}</p>
            {node.required && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-400 rounded">
                Required
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">{node.description}</p>
        </div>
      </div>

      {/* Connector arrow */}
      {!isLast && edge && (
        <div className="flex items-center gap-2 ml-5 py-1">
          <div className="w-[2px] h-4 bg-zinc-700" />
          <ArrowRight className="w-3 h-3 text-zinc-600" />
          <span className="text-[10px] text-zinc-600">{edge.label}</span>
        </div>
      )}
    </motion.div>
  );
}

function Principle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs font-medium text-zinc-300">{title}</p>
        <p className="text-[10px] text-zinc-500">{description}</p>
      </div>
    </div>
  );
}
