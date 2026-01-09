"use client";

import { useState } from "react";
import {
  CheckSquare,
  Square,
  X,
  Shield,
  Download,
  Bot,
  Check,
  AlertTriangle,
  FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Finding, Severity } from "@vibecheck/schema";

interface BatchActionsToolbarProps {
  findings: Finding[];
  selectedIds: Set<string>;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onToggleSelect: (id: string) => void;
  onBatchWaive?: (ids: string[], reason: string) => void;
  onBatchExport?: (ids: string[], format: "json" | "csv" | "markdown") => void;
}

export function BatchActionsToolbar({
  findings,
  selectedIds,
  onSelectAll,
  onDeselectAll,
  onToggleSelect: _onToggleSelect,
  onBatchWaive,
  onBatchExport,
}: BatchActionsToolbarProps) {
  void _onToggleSelect; // Available for future row-level toggle from toolbar
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const selectedFindings = findings.filter((f) => selectedIds.has(f.id));
  const hasSelection = selectedIds.size > 0;
  const allSelected = selectedIds.size === findings.length && findings.length > 0;

  // Count selected by severity
  const severityCounts = selectedFindings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, {} as Record<Severity, number>);

  const hasHighSeverity = (severityCounts.critical || 0) + (severityCounts.high || 0) > 0;

  const handleCopyAllPrompts = async () => {
    const prompts = selectedFindings
      .map((f) => f.enhancements?.aiPrompt?.template || `Fix: ${f.title}\n${f.description}`)
      .join("\n\n---\n\n");

    await navigator.clipboard.writeText(prompts);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleExportMarkdown = () => {
    const markdown = generateMarkdownReport(selectedFindings);
    downloadFile(markdown, "findings-report.md", "text/markdown");
    onBatchExport?.(Array.from(selectedIds), "markdown");
  };

  const handleExportJSON = () => {
    const json = JSON.stringify(selectedFindings, null, 2);
    downloadFile(json, "findings.json", "application/json");
    onBatchExport?.(Array.from(selectedIds), "json");
  };

  const handleExportCSV = () => {
    const csv = generateCSV(selectedFindings);
    downloadFile(csv, "findings.csv", "text/csv");
    onBatchExport?.(Array.from(selectedIds), "csv");
  };

  if (!hasSelection) {
    return (
      <div className="flex items-center gap-4 p-4 border-b">
        <Button
          variant="ghost"
          size="sm"
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="text-muted-foreground"
        >
          {allSelected ? (
            <CheckSquare className="w-4 h-4 mr-2" />
          ) : (
            <Square className="w-4 h-4 mr-2" />
          )}
          Select All ({findings.length})
        </Button>
        <span className="text-sm text-muted-foreground">
          Select findings for batch actions
        </span>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-4 p-4 border-b sticky top-0 z-10",
      "bg-primary/5 border-primary/20"
    )}>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDeselectAll}
          className="text-muted-foreground"
        >
          <X className="w-4 h-4" />
        </Button>
        <span className="font-medium">
          {selectedIds.size} selected
        </span>
        {hasHighSeverity && (
          <span className="flex items-center gap-1 text-sm text-orange-400">
            <AlertTriangle className="w-4 h-4" />
            {(severityCounts.critical || 0) + (severityCounts.high || 0)} high/critical
          </span>
        )}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {/* Copy AI Prompts */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyAllPrompts}
        >
          {copiedPrompt ? (
            <>
              <Check className="w-4 h-4 mr-2 text-emerald-400" />
              Copied!
            </>
          ) : (
            <>
              <Bot className="w-4 h-4 mr-2" />
              Copy AI Prompts
            </>
          )}
        </Button>

        {/* Export Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <FileDown className="w-4 h-4 mr-2" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={handleExportMarkdown}>
              <Download className="w-4 h-4 mr-2" />
              Markdown Report
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportJSON}>
              <Download className="w-4 h-4 mr-2" />
              JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportCSV}>
              <Download className="w-4 h-4 mr-2" />
              CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Batch Waive */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onBatchWaive?.(Array.from(selectedIds), "batch_waive")}
          className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
        >
          <Shield className="w-4 h-4 mr-2" />
          Waive Selected
        </Button>
      </div>
    </div>
  );
}

/**
 * Selectable finding row wrapper
 */
interface SelectableFindingRowProps {
  findingId: string;
  isSelected: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function SelectableFindingRow({
  findingId: _findingId,
  isSelected,
  onToggle,
  children,
}: SelectableFindingRowProps) {
  void _findingId; // Available for data attributes or analytics
  return (
    <div className="relative group">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }}
        className={cn(
          "absolute left-2 top-1/2 -translate-y-1/2 z-10",
          "p-1.5 rounded-md transition-colors",
          "hover:bg-muted",
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
      >
        {isSelected ? (
          <CheckSquare className="w-5 h-5 text-primary" />
        ) : (
          <Square className="w-5 h-5 text-muted-foreground" />
        )}
      </button>
      <div className={cn(
        "transition-all",
        isSelected && "pl-10 bg-primary/5"
      )}>
        {children}
      </div>
    </div>
  );
}

/**
 * Hook for managing batch selection state
 */
export function useBatchSelection(findings: Finding[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectAll = () => {
    setSelectedIds(new Set(findings.map((f) => f.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isSelected = (id: string) => selectedIds.has(id);

  return {
    selectedIds,
    selectAll,
    deselectAll,
    toggleSelect,
    isSelected,
  };
}

// Helper functions for export
function generateMarkdownReport(findings: Finding[]): string {
  const lines = [
    "# Security Findings Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Total Findings: ${findings.length}`,
    "",
    "## Summary",
    "",
    `- Critical: ${findings.filter((f) => f.severity === "critical").length}`,
    `- High: ${findings.filter((f) => f.severity === "high").length}`,
    `- Medium: ${findings.filter((f) => f.severity === "medium").length}`,
    `- Low: ${findings.filter((f) => f.severity === "low").length}`,
    `- Info: ${findings.filter((f) => f.severity === "info").length}`,
    "",
    "## Findings",
    "",
  ];

  for (const finding of findings) {
    lines.push(`### ${finding.ruleId}: ${finding.title}`);
    lines.push("");
    lines.push(`**Severity:** ${finding.severity.toUpperCase()}`);
    lines.push(`**Category:** ${finding.category}`);
    lines.push(`**Confidence:** ${Math.round(finding.confidence * 100)}%`);
    lines.push("");

    if (finding.enhancements?.plainEnglish) {
      lines.push("**What's Wrong:**");
      lines.push(finding.enhancements.plainEnglish.problem);
      lines.push("");
    }

    lines.push("**Description:**");
    lines.push(finding.description);
    lines.push("");

    lines.push("**Location:**");
    for (const ev of finding.evidence) {
      lines.push(`- ${ev.file}:${ev.startLine}`);
    }
    lines.push("");

    lines.push("**Recommended Fix:**");
    lines.push(finding.remediation.recommendedFix);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

function generateCSV(findings: Finding[]): string {
  const headers = ["ID", "Rule ID", "Title", "Severity", "Category", "Confidence", "File", "Line", "Description"];
  const rows = findings.map((f) => [
    f.id,
    f.ruleId,
    `"${f.title.replace(/"/g, '""')}"`,
    f.severity,
    f.category,
    Math.round(f.confidence * 100) + "%",
    f.evidence[0]?.file || "",
    f.evidence[0]?.startLine?.toString() || "",
    `"${f.description.replace(/"/g, '""')}"`,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
