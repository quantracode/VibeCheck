"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, Filter, X, FileSearch, Upload } from "lucide-react";
import Link from "next/link";
import {
  useArtifactStore,
  filterAndSortFindings,
  type SeverityFilter,
  type CategoryFilter,
  type FindingsFilter,
} from "@/lib/store";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FindingsTable } from "@/components/FindingsTable";
import { EmptyState } from "@/components/EmptyState";
import { PolicyEvaluator } from "@/components/PolicyEvaluator";
import { WaiverManager } from "@/components/WaiverManager";

const severityOptions: { value: SeverityFilter; label: string }[] = [
  { value: "all", label: "All Severities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "info", label: "Info" },
];

const categoryOptions: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All Categories" },
  { value: "auth", label: "Auth" },
  { value: "validation", label: "Validation" },
  { value: "middleware", label: "Middleware" },
  { value: "secrets", label: "Secrets" },
  { value: "injection", label: "Injection" },
  { value: "privacy", label: "Privacy" },
  { value: "config", label: "Config" },
  { value: "other", label: "Other" },
];

export default function FindingsPage() {
  const { artifacts, selectedArtifactId } = useArtifactStore();
  const selectedArtifact = useMemo(
    () => artifacts.find((a) => a.id === selectedArtifactId),
    [artifacts, selectedArtifactId]
  );
  const findings = useMemo(
    () => selectedArtifact?.artifact.findings ?? [],
    [selectedArtifact]
  );

  const [filter, setFilter] = useState<FindingsFilter>({
    severity: "all",
    category: "all",
    search: "",
  });

  const filteredFindings = useMemo(
    () => filterAndSortFindings(findings, filter),
    [findings, filter]
  );

  const hasActiveFilters =
    filter.severity !== "all" ||
    filter.category !== "all" ||
    filter.search.trim() !== "";

  const clearFilters = () => {
    setFilter({ severity: "all", category: "all", search: "" });
  };

  // No artifact loaded
  if (!selectedArtifact) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Findings</h1>
          <p className="text-muted-foreground mt-1">
            Security findings from the scan
          </p>
        </div>
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<Upload className="w-8 h-8 text-muted-foreground" />}
              title="No artifact loaded"
              description="Import a scan artifact from the Dashboard to view findings."
              action={
                <Link href="/">
                  <Button>Go to Dashboard</Button>
                </Link>
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Findings</h1>
          <p className="text-muted-foreground mt-1">
            <span className="font-semibold text-foreground tabular-nums">
              {filteredFindings.length}
            </span>
            {hasActiveFilters && (
              <span>
                {" "}
                of{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {findings.length}
                </span>
              </span>
            )}{" "}
            finding{filteredFindings.length !== 1 ? "s" : ""}
            {hasActiveFilters && " matching filters"}
          </p>
        </div>
      </div>

      {/* Policy Gate */}
      <PolicyEvaluator />

      {/* Waivers Panel */}
      <WaiverManager />

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-wrap items-center gap-3"
      >
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search findings..."
            value={filter.search}
            onChange={(e) =>
              setFilter((f) => ({ ...f, search: e.target.value }))
            }
            className="pl-9"
            aria-label="Search findings"
          />
        </div>

        <Select
          value={filter.severity}
          onValueChange={(value) =>
            setFilter((f) => ({ ...f, severity: value as SeverityFilter }))
          }
        >
          <SelectTrigger className="w-[160px]" aria-label="Filter by severity">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            {severityOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filter.category}
          onValueChange={(value) =>
            setFilter((f) => ({ ...f, category: value as CategoryFilter }))
          }
        >
          <SelectTrigger className="w-[160px]" aria-label="Filter by category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categoryOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground"
          >
            <X className="w-4 h-4 mr-1" />
            Clear filters
          </Button>
        )}
      </motion.div>

      {/* Findings List */}
      {filteredFindings.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<FileSearch className="w-8 h-8 text-muted-foreground" />}
              title={hasActiveFilters ? "No matching findings" : "No findings"}
              description={
                hasActiveFilters
                  ? "Try adjusting your filters to see more results."
                  : "This scan produced no security findings."
              }
              action={
                hasActiveFilters ? (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.1 }}
        >
          <FindingsTable findings={filteredFindings} />
        </motion.div>
      )}
    </div>
  );
}
