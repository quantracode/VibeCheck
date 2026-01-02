"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, Filter, X, FileSearch, Upload, AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useArtifactStore } from "@/lib/store";
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
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";

type ClaimType = "all" | "AUTH_ENFORCED" | "INPUT_VALIDATED" | "CSRF_ENABLED" | "RATE_LIMITED" | "ENCRYPTED_AT_REST" | "MIDDLEWARE_PROTECTED" | "OTHER";
type ClaimScope = "all" | "route" | "module" | "global";
type ClaimStrength = "all" | "weak" | "medium" | "strong";

interface Intent {
  intentId: string;
  type: string;
  scope: string;
  targetRouteId?: string;
  source: string;
  location: { file: string; startLine: number; endLine: number };
  strength: string;
  textEvidence: string;
}

const typeOptions: { value: ClaimType; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "AUTH_ENFORCED", label: "Auth Enforced" },
  { value: "INPUT_VALIDATED", label: "Input Validated" },
  { value: "CSRF_ENABLED", label: "CSRF Enabled" },
  { value: "RATE_LIMITED", label: "Rate Limited" },
  { value: "ENCRYPTED_AT_REST", label: "Encrypted at Rest" },
  { value: "MIDDLEWARE_PROTECTED", label: "Middleware Protected" },
  { value: "OTHER", label: "Other" },
];

const scopeOptions: { value: ClaimScope; label: string }[] = [
  { value: "all", label: "All Scopes" },
  { value: "route", label: "Route" },
  { value: "module", label: "Module" },
  { value: "global", label: "Global" },
];

const strengthOptions: { value: ClaimStrength; label: string }[] = [
  { value: "all", label: "All Strengths" },
  { value: "strong", label: "Strong" },
  { value: "medium", label: "Medium" },
  { value: "weak", label: "Weak" },
];

function IntentRow({ intent, isUnproven }: { intent: Intent; isUnproven: boolean }) {
  const strengthColor = {
    strong: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
    medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
    weak: "bg-red-500/10 text-red-500 border-red-500/30",
  }[intent.strength] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-500/30";

  const typeLabel = intent.type.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "p-4 rounded-lg border bg-card/50 hover:bg-card transition-colors",
        isUnproven && "border-yellow-500/30 bg-yellow-500/5"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{typeLabel}</span>
            <span className={cn("px-2 py-0.5 rounded text-xs border", strengthColor)}>
              {intent.strength}
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-zinc-500/10 text-zinc-400 border border-zinc-500/30">
              {intent.scope}
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-zinc-500/10 text-zinc-400 border border-zinc-500/30">
              {intent.source}
            </span>
            {isUnproven && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-yellow-500/10 text-yellow-500 border border-yellow-500/30">
                <AlertTriangle className="w-3 h-3" />
                Unproven
              </span>
            )}
            {!isUnproven && intent.targetRouteId && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3" />
                Proven
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-mono mt-2 truncate">
            {intent.location.file}:{intent.location.startLine}
          </p>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            &quot;{intent.textEvidence}&quot;
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default function IntentsPage() {
  const { artifacts, selectedArtifactId } = useArtifactStore();
  const selectedArtifact = useMemo(
    () => artifacts.find((a) => a.id === selectedArtifactId),
    [artifacts, selectedArtifactId]
  );

  // Extract intents from artifact
  const intents: Intent[] = useMemo(() => {
    const intentMap = selectedArtifact?.artifact.intentMap;
    if (!intentMap) return [];
    // Handle both object format { intents: [...] } and direct array
    if (Array.isArray(intentMap)) return intentMap as Intent[];
    if ("intents" in intentMap && Array.isArray(intentMap.intents)) {
      return intentMap.intents as Intent[];
    }
    return [];
  }, [selectedArtifact]);

  // Extract proof traces to identify unproven claims
  const proofTraces = useMemo(() => {
    const traces = selectedArtifact?.artifact.proofTraces;
    if (!traces || typeof traces !== "object") return {};
    return traces as Record<string, { summary: string; nodes: unknown[] }>;
  }, [selectedArtifact]);

  // Determine which intents are unproven
  const unprovenIntentIds = useMemo(() => {
    const unproven = new Set<string>();
    for (const intent of intents) {
      if (!intent.targetRouteId) continue;
      const trace = proofTraces[intent.targetRouteId];
      if (!trace) {
        unproven.add(intent.intentId);
      }
    }
    return unproven;
  }, [intents, proofTraces]);

  const [filter, setFilter] = useState({
    type: "all" as ClaimType,
    scope: "all" as ClaimScope,
    strength: "all" as ClaimStrength,
    search: "",
    unprovenOnly: false,
  });

  const filteredIntents = useMemo(() => {
    let result = [...intents];

    if (filter.type !== "all") {
      result = result.filter((i) => i.type === filter.type);
    }
    if (filter.scope !== "all") {
      result = result.filter((i) => i.scope === filter.scope);
    }
    if (filter.strength !== "all") {
      result = result.filter((i) => i.strength === filter.strength);
    }
    if (filter.search.trim()) {
      const searchLower = filter.search.toLowerCase();
      result = result.filter(
        (i) =>
          i.textEvidence.toLowerCase().includes(searchLower) ||
          i.location.file.toLowerCase().includes(searchLower) ||
          i.type.toLowerCase().includes(searchLower)
      );
    }
    if (filter.unprovenOnly) {
      result = result.filter((i) => unprovenIntentIds.has(i.intentId));
    }

    // Sort by strength (strong first), then by type
    const strengthOrder = { strong: 0, medium: 1, weak: 2 };
    result.sort((a, b) => {
      const strengthDiff = (strengthOrder[a.strength as keyof typeof strengthOrder] ?? 3) -
                          (strengthOrder[b.strength as keyof typeof strengthOrder] ?? 3);
      if (strengthDiff !== 0) return strengthDiff;
      return a.type.localeCompare(b.type);
    });

    return result;
  }, [intents, filter, unprovenIntentIds]);

  const hasActiveFilters =
    filter.type !== "all" ||
    filter.scope !== "all" ||
    filter.strength !== "all" ||
    filter.search.trim() !== "" ||
    filter.unprovenOnly;

  const clearFilters = () => {
    setFilter({ type: "all", scope: "all", strength: "all", search: "", unprovenOnly: false });
  };

  // No artifact loaded
  if (!selectedArtifact) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Intent Claims</h1>
          <p className="text-muted-foreground mt-1">
            Security claims mined from comments, identifiers, and imports
          </p>
        </div>
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<Upload className="w-8 h-8 text-muted-foreground" />}
              title="No artifact loaded"
              description="Import a scan artifact from the Dashboard to view intent claims."
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

  // No intents in artifact
  if (intents.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Intent Claims</h1>
          <p className="text-muted-foreground mt-1">
            Security claims mined from comments, identifiers, and imports
          </p>
        </div>
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<FileSearch className="w-8 h-8 text-muted-foreground" />}
              title="No intent claims found"
              description="This artifact doesn't contain intent claims. Re-scan with --emit-intents to generate them."
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
          <h1 className="text-3xl font-bold tracking-tight">Intent Claims</h1>
          <p className="text-muted-foreground mt-1">
            <span className="font-semibold text-foreground tabular-nums">
              {filteredIntents.length}
            </span>
            {hasActiveFilters && (
              <span>
                {" "}
                of{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {intents.length}
                </span>
              </span>
            )}{" "}
            intent{filteredIntents.length !== 1 ? "s" : ""}
            {hasActiveFilters && " matching filters"}
            {unprovenIntentIds.size > 0 && (
              <span className="text-yellow-500">
                {" "}({unprovenIntentIds.size} unproven)
              </span>
            )}
          </p>
        </div>
      </div>

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
            placeholder="Search intents..."
            value={filter.search}
            onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
            className="pl-9"
            aria-label="Search intents"
          />
        </div>

        <Select
          value={filter.type}
          onValueChange={(value) => setFilter((f) => ({ ...f, type: value as ClaimType }))}
        >
          <SelectTrigger className="w-[180px]" aria-label="Filter by type">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filter.scope}
          onValueChange={(value) => setFilter((f) => ({ ...f, scope: value as ClaimScope }))}
        >
          <SelectTrigger className="w-[140px]" aria-label="Filter by scope">
            <SelectValue placeholder="Scope" />
          </SelectTrigger>
          <SelectContent>
            {scopeOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filter.strength}
          onValueChange={(value) => setFilter((f) => ({ ...f, strength: value as ClaimStrength }))}
        >
          <SelectTrigger className="w-[140px]" aria-label="Filter by strength">
            <SelectValue placeholder="Strength" />
          </SelectTrigger>
          <SelectContent>
            {strengthOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={filter.unprovenOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter((f) => ({ ...f, unprovenOnly: !f.unprovenOnly }))}
          className={cn(filter.unprovenOnly && "bg-yellow-500 hover:bg-yellow-600 text-black")}
        >
          <AlertTriangle className="w-4 h-4 mr-1" />
          Unproven only
        </Button>

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

      {/* Intent List */}
      {filteredIntents.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<FileSearch className="w-8 h-8 text-muted-foreground" />}
              title={hasActiveFilters ? "No matching intents" : "No intents"}
              description={
                hasActiveFilters
                  ? "Try adjusting your filters to see more results."
                  : "No security intent claims were found in the codebase."
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
          className="space-y-3"
        >
          {filteredIntents.map((intent) => (
            <IntentRow
              key={intent.intentId}
              intent={intent}
              isUnproven={unprovenIntentIds.has(intent.intentId)}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}
